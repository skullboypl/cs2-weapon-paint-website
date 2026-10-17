<?php
require_once __DIR__ . '/CloudHubAccounts.php';
final class CloudHubEventConflict extends RuntimeException {}
/** Raw server observations only. All rewards are calculated inside the backend transaction. */
final class CloudHubRounds {
    public function __construct(private PDO $db) {}
    private static function integer(mixed $value, int $min, int $max): int {
        if (!is_int($value) || $value<$min || $value>$max) { throw new InvalidArgumentException('Invalid integer'); }
        return $value;
    }
    public static function validate(array $e, int $now): array {
        foreach (['event_id','round_id'] as $key) {
            if (!is_string($e[$key]??null) || !preg_match('/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/D',$e[$key])) { throw new InvalidArgumentException('Invalid event identity'); }
        }
        if (($e['version']??null)!==1 || ($e['kind']??null)!=='round.completed' || ($e['warmup']??null)!==false || ($e['has_bots']??null)!==false) { throw new InvalidArgumentException('Unsupported round'); }
        self::integer($e['ended_at']??null,$now-604800,$now+60);
        $duration=self::integer($e['duration']??null,1,3600);
        $winner=self::integer($e['winner']??null,2,3);
        $reasons=[1=>2,7=>3,8=>3,9=>2,11=>3,12=>3,13=>2];
        $reason=self::integer($e['reason']??null,1,20);
        if (($reasons[$reason]??null)!==$winner) { throw new InvalidArgumentException('Unconfirmed round outcome'); }
        if (!is_array($e['players']??null) || !array_is_list($e['players']) || count($e['players'])<2 || count($e['players'])>64 || !is_array($e['deaths']??null) || !array_is_list($e['deaths']) || count($e['deaths'])>64) { throw new InvalidArgumentException('Invalid roster'); }
        $players=[];
        foreach ($e['players'] as $p) {
            if (!is_array($p) || !is_string($p['steamid']??null)) { throw new InvalidArgumentException('Invalid player'); }
            $id=CloudHubAccounts::steamId($p['steamid']);
            if (isset($players[$id])) { throw new InvalidArgumentException('Duplicate player'); }
            self::integer($p['team']??null,2,3); self::integer($p['active_seconds']??null,0,$duration);
            if (!is_bool($p['finished']??null)) { throw new InvalidArgumentException('Invalid participation'); }
            $players[$id]=$p;
        }
        if (count(array_unique(array_column($e['players'],'team')))!==2) { throw new InvalidArgumentException('Both teams required'); }
        $dead=[];
        foreach ($e['deaths'] as $d) {
            if (!is_array($d) || !is_string($d['victim']??null) || !isset($players[$d['victim']]) || isset($dead[$d['victim']]) || !is_bool($d['headshot']??null)) { throw new InvalidArgumentException('Invalid death'); }
            $dead[$d['victim']]=true;
            foreach (['killer','assister'] as $key) {
                if (!array_key_exists($key,$d) || ($d[$key]!==null && (!is_string($d[$key]) || !isset($players[$d[$key]])))) { throw new InvalidArgumentException('Invalid combat identity'); }
            }
            if ($d['assister']!==null && ($d['assister']===$d['victim'] || $d['assister']===$d['killer'] || $d['killer']===null || $players[$d['assister']]['team']!==$players[$d['killer']]['team'] || $players[$d['assister']]['team']===$players[$d['victim']]['team'])) { throw new InvalidArgumentException('Invalid assist'); }
        }
        return $players;
    }
    private function query(string $sql, array $params=[]): PDOStatement {
        $s=$this->db->prepare($sql); $s->execute($params); return $s;
    }
    public function accept(string $server, string $body, ?int $now=null): array {
        $now ??= time();
        if (!preg_match('/^[a-zA-Z0-9_-]{1,64}$/D',$server)) { throw new InvalidArgumentException('Invalid server'); }
        $e=json_decode($body,true,32,JSON_THROW_ON_ERROR);
        if (!is_array($e)) { throw new InvalidArgumentException('Invalid event'); }
        $players=self::validate($e,$now); ksort($players,SORT_STRING);
        $hash=hash('sha256',$body);
        // Serialize settlement across all servers sharing this schema: pair/hour caps cannot race.
        $lock='ch-round-'.substr(hash('sha256',(string)$this->db->query('SELECT DATABASE()')->fetchColumn()),0,32);
        if ((int)$this->query('SELECT GET_LOCK(?,10)',[$lock])->fetchColumn()!==1) { throw new RuntimeException('Settlement busy'); }
        try {
            $this->db->beginTransaction();
            $old=$this->query('SELECT payload_sha256 FROM cloudhub_processed_events WHERE server_id=? AND event_id=?',[$server,$e['event_id']])->fetchColumn();
            if ($old!==false) {
                if (!hash_equals($old,$hash)) { throw new CloudHubEventConflict('Event identity reused'); }
                $this->db->rollBack(); return ['status'=>'duplicate'];
            }
            if ($this->query('SELECT 1 FROM cloudhub_round_receipts WHERE server_id=? AND round_id=?',[$server,$e['round_id']])->fetchColumn()) { throw new CloudHubEventConflict('Round already settled'); }
            $rules=$this->db->query('SELECT rule_key,value FROM cloudhub_reward_rules')->fetchAll(PDO::FETCH_KEY_PAIR);
            $bounds=['min_players'=>[2,64],'min_round_seconds'=>[1,3600],'min_active_seconds'=>[1,3600],'pair_window_seconds'=>[60,86400],'pair_max_kills'=>[0,100],'hourly_rp_cap'=>[0,100000],'hourly_cc_cap'=>[0,100000],'kill_rp'=>[0,1000],'kill_cc'=>[0,1000],'headshot_rp'=>[0,1000],'headshot_cc'=>[0,1000],'assist_rp'=>[0,1000],'assist_cc'=>[0,1000],'death_rp'=>[-1000,0],'teamkill_rp'=>[-1000,0],'round_win_rp'=>[0,1000],'round_win_cc'=>[0,1000],'round_play_rp'=>[0,1000],'round_play_cc'=>[0,1000]];
            foreach ($bounds as $key=>[$min,$max]) {
                if (!isset($rules[$key]) || !is_numeric($rules[$key]) || (int)$rules[$key]<$min || (int)$rules[$key]>$max) { throw new RuntimeException('Invalid reward configuration'); }
                $rules[$key]=(int)$rules[$key];
            }
            $eligible=count(array_filter($players,fn($p)=>$p['finished']))>=$rules['min_players'] && $e['duration']>=$rules['min_round_seconds'];
            $stats=[]; $rp=[]; $coins=[]; $actors=[];
            foreach ($players as $id=>$p) {
                $stats[$id]=['kills'=>0,'deaths'=>0,'assists'=>0,'headshots'=>0,'rounds_played'=>0,'rounds_won'=>0,'rounds_lost'=>0,'play_seconds'=>0]; $rp[$id]=0; $coins[$id]=0;
            }
            if ($eligible) foreach ($e['deaths'] as $d) {
                $v=$d['victim']; $k=$d['killer']; $a=$d['assister']; $stats[$v]['deaths']++;
                if ($k===null || $k===$v) { continue; }
                $actors[$k]=true;
                if ($players[$k]['team']===$players[$v]['team']) { $rp[$k]+=$rules['teamkill_rp']; continue; }
                $stats[$k]['kills']++; $stats[$k]['headshots']+=(int)$d['headshot']; $rp[$v]+=$rules['death_rp'];
                if ($a!==null) { $stats[$a]['assists']++; $actors[$a]=true; }
                $prior=(int)$this->query('SELECT COUNT(*) FROM cloudhub_combat_history WHERE killer=? AND victim=? AND ended_at BETWEEN ? AND ?',[$k,$v,$e['ended_at']-$rules['pair_window_seconds'],$e['ended_at']+$rules['pair_window_seconds']])->fetchColumn();
                $this->query('INSERT INTO cloudhub_combat_history VALUES (?,?,?,?,?)',[$server,$e['round_id'],$k,$v,$e['ended_at']]);
                if ($prior >= $rules['pair_max_kills']) { continue; }
                foreach (['rp','cc'] as $unit) {
                    $amount=$rules['kill_'.$unit]+($d['headshot']?$rules['headshot_'.$unit]:0);
                    if ($unit==='rp') { $rp[$k]+=$amount; if ($a!==null) $rp[$a]+=$rules['assist_rp']; }
                    else { $coins[$k]+=$amount; if ($a!==null) $coins[$a]+=$rules['assist_cc']; }
                }
            }
            $seasons=$this->query("SELECT id FROM cloudhub_seasons WHERE status='active' AND starts_at<=? AND ends_at>?",[gmdate('Y-m-d H:i:s',$e['ended_at']),gmdate('Y-m-d H:i:s',$e['ended_at'])])->fetchAll(PDO::FETCH_COLUMN);
            if (count($seasons)>1) { throw new RuntimeException('Overlapping active seasons'); }
            foreach ($players as $id=>$p) {
                if ($eligible && $p['finished'] && ($p['active_seconds'] >= $rules['min_active_seconds'] || isset($actors[$id]))) {
                    $win=$p['team']===$e['winner']; $stats[$id]['rounds_played']=1; $stats[$id]['rounds_won']=(int)$win; $stats[$id]['rounds_lost']=(int)!$win; $stats[$id]['play_seconds']=$p['active_seconds'];
                    $rp[$id]+=$rules['round_play_rp']+($win?$rules['round_win_rp']:0); $coins[$id]+=$rules['round_play_cc']+($win?$rules['round_win_cc']:0);
                }
                $this->query("INSERT IGNORE INTO cloudhub_players(steamid) VALUES (?)",[$id]);
                foreach (['cloudhub_profiles','cloudhub_wallets','cloudhub_player_stats'] as $table) $this->query("INSERT IGNORE INTO $table(steamid) VALUES (?)",[$id]);
                $this->query("INSERT IGNORE INTO cloudhub_player_roles(steamid,role) VALUES (?,'PLAYER')",[$id]);
                $used=$this->query('SELECT COALESCE(SUM(GREATEST(rp_delta,0)),0) rp,COALESCE(SUM(coins),0) cc FROM cloudhub_round_awards WHERE steamid=? AND ended_at BETWEEN ? AND ?',[$id,$e['ended_at']-3600,$e['ended_at']+3600])->fetch(PDO::FETCH_ASSOC);
                $rp[$id]=min($rp[$id],max(0,$rules['hourly_rp_cap']-(int)$used['rp'])); $coins[$id]=min($coins[$id],max(0,$rules['hourly_cc_cap']-(int)$used['cc']));
                $before=(int)$this->query('SELECT balance FROM cloudhub_wallets WHERE steamid=? FOR UPDATE',[$id])->fetchColumn();
                if ($coins[$id]>0) {
                    $after=$before+$coins[$id];
                    $this->query('UPDATE cloudhub_wallets SET balance=? WHERE steamid=?',[$after,$id]);
                    $this->query('INSERT INTO cloudhub_wallet_transactions(operation_key,steamid,amount,balance_before,balance_after,source,reason) VALUES (?,?,?,?,?,?,?)',['round:'.hash('sha256',"$server:{$e['round_id']}:$id"),$id,$coins[$id],$before,$after,'round','Eligible round reward']);
                }
                foreach ([null,...$seasons] as $season) {
                    $table=$season===null?'cloudhub_player_stats':'cloudhub_player_season_stats';
                    if ($season!==null) $this->query("INSERT IGNORE INTO $table(season_id,steamid) VALUES (?,?)",[$season,$id]);
                    $set=['rp=GREATEST(0,rp+?)']; $args=[$rp[$id]];
                    foreach ($stats[$id] as $key=>$value) { $set[]="$key=$key+?"; $args[]=$value; }
                    $args[]=$id; if ($season!==null) $args[]=$season;
                    $this->query("UPDATE $table SET ".implode(',',$set).' WHERE steamid=?'.($season!==null?' AND season_id=?':''),$args);
                }
                $this->query('INSERT INTO cloudhub_round_awards VALUES (?,?,?,?,?,?)',[$server,$e['round_id'],$id,$e['ended_at'],$rp[$id],$coins[$id]]);
            }
            $result=['status'=>'applied','eligible'=>$eligible];
            $this->query('INSERT INTO cloudhub_processed_events(server_id,event_id,payload_sha256) VALUES (?,?,?)',[$server,$e['event_id'],$hash]);
            $this->query('INSERT INTO cloudhub_round_receipts VALUES (?,?,?,?,?)',[$server,$e['round_id'],$e['event_id'],$e['ended_at'],json_encode($result,JSON_THROW_ON_ERROR)]);
            $this->db->commit(); return $result;
        } catch (Throwable $ex) { if ($this->db->inTransaction()) $this->db->rollBack(); throw $ex; }
        finally { $this->query('SELECT RELEASE_LOCK(?)',[$lock]); }
    }
}
