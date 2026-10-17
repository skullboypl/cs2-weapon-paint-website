<?php
require_once __DIR__.'/../backend/class/CloudHubRounds.php';
require_once __DIR__.'/../backend/class/CloudHubIngestAuth.php';
$db=Database::getInstance()->getConnection();
if (!preg_match('/^cloudhub_test_[a-f0-9]+$/D',(string)$db->query('SELECT DATABASE()')->fetchColumn())) throw new RuntimeException('Disposable DB required');
$n=0;
$check=function($ok,$why)use(&$n){if(!$ok)throw new RuntimeException($why);$n++;};
$reject=function(callable $f,string $why)use($check){try{$f();}catch(Throwable $e){$check(true,$why);return;}$check(false,$why);};
$uuid=fn()=>sprintf('%s-%s-%s-%s-%s',bin2hex(random_bytes(4)),bin2hex(random_bytes(2)),bin2hex(random_bytes(2)),bin2hex(random_bytes(2)),bin2hex(random_bytes(6)));
$ids=['76561198000000101','76561198000000102','76561198000000103','76561198000000104'];
$round=function()use($uuid,$ids){return ['version'=>1,'kind'=>'round.completed','event_id'=>$uuid(),'round_id'=>$uuid(),'ended_at'=>time(),'duration'=>60,'winner'=>2,'reason'=>9,'warmup'=>false,'has_bots'=>false,'players'=>array_map(fn($i)=>['steamid'=>$ids[$i],'team'=>$i<2?2:3,'active_seconds'=>20,'finished'=>true],range(0,3)),'deaths'=>[['killer'=>$ids[0],'victim'=>$ids[2],'assister'=>$ids[1],'headshot'=>true]]];};
$service=new CloudHubRounds($db); $send=fn($e)=>$service->accept('test',json_encode($e,JSON_THROW_ON_ERROR));
$wallet=fn($id)=>(int)$db->query("SELECT balance FROM cloudhub_wallets WHERE steamid='$id'")->fetchColumn();
$stat=fn($id,$field)=>(int)$db->query("SELECT $field FROM cloudhub_player_stats WHERE steamid='$id'")->fetchColumn();
$e=$round(); $body=json_encode($e); $check($send($e)['status']==='applied','apply round');
$check($wallet($ids[0])===6 && $stat($ids[0],'rp')===19,'headshot and round awards');
$check($wallet($ids[1])===4 && $stat($ids[1],'assists')===1,'assist awards');
$check($stat($ids[2],'deaths')===1 && $stat($ids[2],'rp')===0,'death and nonnegative RP');
$check($stat($ids[0],'matches_won')===0 && $stat($ids[2],'matches_lost')===0,'no match inference');
$check($send($e)['status']==='duplicate' && $wallet($ids[0])===6,'exact replay');
$changed=$e;$changed['duration']=61;$reject(fn()=>$send($changed),'hash conflict');
$changed=$e;$changed['event_id']=$uuid();$reject(fn()=>$send($changed),'round duplicate with new event');
foreach(['warmup','has_bots'] as $flag){$bad=$round();$bad[$flag]=true;$reject(fn()=>$send($bad),$flag);}
$bad=$round();$bad['winner']=3;$reject(fn()=>$send($bad),'inconsistent winner');
$bad=$round();$bad['players'][0]['steamid']='1 OR 1=1';$reject(fn()=>$send($bad),'invalid SteamID');
$bad=$round();$bad['deaths'][]=$bad['deaths'][0];$reject(fn()=>$send($bad),'duplicate victim');
$bad=$round();$bad['ended_at']=time()-604900;$reject(fn()=>$send($bad),'expired event');
$small=$round();$small['players']=[$small['players'][0],$small['players'][2]];$small['deaths'][0]['assister']=null;
$before=$wallet($ids[0]);$check($send($small)['eligible']===false && $wallet($ids[0])===$before,'minimum real players');
$send($round());$send($round());$before=$wallet($ids[0]);$kills=$stat($ids[0],'kills');$send($round());
$check($wallet($ids[0])-$before===3 && $stat($ids[0],'kills')===$kills+1,'pair cap retains stats suppresses combat rewards');
$afk=$round();$afk['deaths']=[];foreach($afk['players'] as &$p)$p['active_seconds']=0;unset($p);$before=$wallet($ids[0]);$send($afk);$check($wallet($ids[0])===$before,'AFK cannot earn round coins');
$left=$round();$left['deaths']=[];$left['players'][0]['finished']=false;$send($left);$check($wallet($ids[0])===$before,'disconnected player no round payout');
$suicide=$round();$suicide['deaths']=[['killer'=>$ids[0],'victim'=>$ids[0],'assister'=>null,'headshot'=>false]];$oldKills=$stat($ids[0],'kills');$send($suicide);$check($stat($ids[0],'kills')===$oldKills,'suicide not a kill');
$tk=$round();$tk['deaths']=[['killer'=>$ids[0],'victim'=>$ids[1],'assister'=>null,'headshot'=>false]];$beforeRp=$stat($ids[0],'rp');$send($tk);$check($stat($ids[0],'rp')===max(0,$beforeRp-14),'teamkill penalty');
$db->exec("UPDATE cloudhub_reward_rules SET value=0 WHERE rule_key IN ('hourly_rp_cap','hourly_cc_cap')");$before=$wallet($ids[0]);$beforeRp=$stat($ids[0],'rp');$send($round());$check($wallet($ids[0])===$before && $stat($ids[0],'rp')===$beforeRp,'configurable caps');
$db->exec("UPDATE cloudhub_reward_rules SET value=500 WHERE rule_key='hourly_rp_cap'");$db->exec("UPDATE cloudhub_reward_rules SET value=100 WHERE rule_key='hourly_cc_cap'");
$db->exec("CREATE TRIGGER cloudhub_test_ledger_fail BEFORE INSERT ON cloudhub_wallet_transactions FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='forced rollback'");
$retry=$round();$before=$wallet($ids[0]);$beforeRp=$stat($ids[0],'rp');$reject(fn()=>$send($retry),'ledger write failure');
$check($wallet($ids[0])===$before && $stat($ids[0],'rp')===$beforeRp,'wallet/stats rollback');
$s=$db->prepare('SELECT COUNT(*) FROM cloudhub_processed_events WHERE event_id=?');$s->execute([$retry['event_id']]);$check((int)$s->fetchColumn()===0,'event marker rolls back');
$db->exec('DROP TRIGGER cloudhub_test_ledger_fail');$check($send($retry)['status']==='applied','retry after rollback');
$db->exec("INSERT INTO cloudhub_seasons(name,starts_at,ends_at,status,policy_json) VALUES ('Test',UTC_TIMESTAMP()-INTERVAL 1 DAY,UTC_TIMESTAMP()+INTERVAL 1 DAY,'active','{}')");$before=$wallet($ids[0]);$send($round());$check((int)$db->query('SELECT SUM(rounds_played) FROM cloudhub_player_season_stats')->fetchColumn()===4 && $wallet($ids[0])>$before,'season stats without wallet reset');
$db->exec("UPDATE cloudhub_seasons SET status='closed'");
$a=new CloudHubAccounts($db);$check($a->roles($ids[0])===['PLAYER'] && $db->query("SELECT steam_verified_at FROM cloudhub_players WHERE steamid='{$ids[0]}'")->fetchColumn()===null,'game cannot grant verified identity or owner');
foreach([0=>'bronze',500=>'silver',1200=>'gold',2500=>'platinum',4500=>'diamond',7500=>'master'] as $rp=>$rank){$db->exec("UPDATE cloudhub_player_stats SET rp=$rp WHERE steamid='{$ids[0]}'");$check($a->account($ids[0])['rank']['rank_key']===$rank,'rank '.$rank);}
$key=str_repeat('test-only-',4);$stamp=(string)time();$headers=['server'=>'test','timestamp'=>$stamp,'signature'=>CloudHubIngestAuth::signature($key,'test',$stamp,$body)];
$check(CloudHubIngestAuth::verify($headers,$body,['test'=>$key],time())==='test','valid HMAC');
$reject(fn()=>CloudHubIngestAuth::verify($headers,$body.' ',['test'=>$key],time()),'tampered body');
$reject(fn()=>CloudHubIngestAuth::verify($headers,$body,['test'=>$key],time()+301),'expired signature');
$reject(fn()=>CloudHubIngestAuth::verify($headers,$body,['other'=>$key],time()),'unknown server');
// Two independent processes race on the same event. Both use disposable config only.
$race=$round();$file=tempnam(sys_get_temp_dir(),'ch-race-');file_put_contents($file,json_encode($race));$workers=[];
for($i=0;$i<2;$i++){$pipes=[];$p=proc_open([PHP_BINARY,__DIR__.'/round-worker.php',$file],[1=>['pipe','w'],2=>['pipe','w']],$pipes);$workers[]=[$p,$pipes];}
$results=[];foreach($workers as [$p,$pipes]){$out=stream_get_contents($pipes[1]);$err=stream_get_contents($pipes[2]);fclose($pipes[1]);fclose($pipes[2]);$code=proc_close($p);$check($code===0,'parallel worker '.$err);$results[]=trim($out);}unlink($file);sort($results);$check($results===['applied','duplicate'],'concurrent exactly-once settlement');
$cross=$round();$before=$wallet($ids[0]);$check($service->accept('second-server',json_encode($cross))['status']==='applied' && $wallet($ids[0])-$before===3,'pair antifarm shared across servers');
$late=$round();$late['ended_at']-=60;$before=$wallet($ids[0]);$send($late);$check($wallet($ids[0])-$before===3,'out-of-order replay cannot bypass pair cap');
$db->exec("UPDATE cloudhub_reward_rules SET value=-1 WHERE rule_key='kill_cc'");$invalidRule=$round();$before=$wallet($ids[0]);$reject(fn()=>$send($invalidRule),'invalid rule fails closed');$check($wallet($ids[0])===$before,'invalid rule no wallet change');$db->exec("UPDATE cloudhub_reward_rules SET value=2 WHERE rule_key='kill_cc'");
$db->exec("INSERT INTO cloudhub_seasons(name,starts_at,ends_at,status,policy_json) VALUES ('Overlap1',UTC_TIMESTAMP()-INTERVAL 1 DAY,UTC_TIMESTAMP()+INTERVAL 1 DAY,'active','{}'),('Overlap2',UTC_TIMESTAMP()-INTERVAL 1 DAY,UTC_TIMESTAMP()+INTERVAL 1 DAY,'active','{}')");
$reject(fn()=>$send($round()),'overlapping seasons reject');$db->exec("UPDATE cloudhub_seasons SET status='closed'");
foreach($ids as $id){$sum=(int)$db->query("SELECT COALESCE(SUM(amount),0) FROM cloudhub_wallet_transactions WHERE steamid='$id'")->fetchColumn();$check($sum===$wallet($id),'wallet reconciles with ledger');}
$vector=json_decode(file_get_contents(__DIR__.'/protocol-vector.json'),true,512,JSON_THROW_ON_ERROR);
$check(CloudHubIngestAuth::signature($vector['key'],$vector['server'],$vector['timestamp'],$vector['body'])===$vector['signature'],'shared UTF-8 HMAC vector');
fwrite(STDERR,"CloudHub rounds assertions passed: $n\n");
