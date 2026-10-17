<?php
final class CloudHubAccounts {
    public function __construct(private PDO $db) {}
    public static function enabled(): bool {
        return defined('CLOUDHUB_CORE_ENABLED') && CLOUDHUB_CORE_ENABLED === true;
    }
    public static function steamId(string $id): string {
        // Canonical decimal string, never a JS number or a floating-point conversion.
        if (!preg_match('/^7656119[0-9]{10}$/D', $id)) { throw new InvalidArgumentException('Invalid SteamID64'); }
        return $id;
    }
    /** Trusted server-side callers only. Never accept verifiedSteam from HTTP input. */
    public function register(string $steamid, string $nickname, ?string $avatar = null, bool $verifiedSteam = false): void {
        self::steamId($steamid);
        if (preg_match('//u', $nickname) !== 1 || preg_match_all('/./us', $nickname) > 128 || preg_match('/[\x00-\x1f\x7f]/', $nickname)) {
            $nickname = 'Player';
        }
        if ($nickname === '') { $nickname = 'Player'; }
        if ($avatar !== null && (!filter_var($avatar, FILTER_VALIDATE_URL) || !preg_match('~^https://(?:[a-z0-9-]+\.)*(?:steamstatic\.com|steamusercontent\.com)/~i', $avatar) || strlen($avatar) > 512)) {
            $avatar = null;
        }
        $this->db->beginTransaction();
        try {
            $this->db->prepare('INSERT INTO cloudhub_players(steamid,nickname,avatar_url,steam_verified_at) VALUES (?,?,?,IF(?,UTC_TIMESTAMP(6),NULL)) ON DUPLICATE KEY UPDATE nickname=VALUES(nickname),avatar_url=COALESCE(VALUES(avatar_url),avatar_url),last_seen_at=UTC_TIMESTAMP(6),steam_verified_at=COALESCE(VALUES(steam_verified_at),steam_verified_at)')->execute([$steamid,$nickname,$avatar,(int)$verifiedSteam]);
            foreach (['cloudhub_profiles','cloudhub_wallets','cloudhub_player_stats'] as $table) {
                $this->db->prepare("INSERT IGNORE INTO $table(steamid) VALUES (?)")->execute([$steamid]);
            }
            $this->db->prepare("INSERT IGNORE INTO cloudhub_player_roles(steamid,role) VALUES (?,'PLAYER')")->execute([$steamid]);
            $this->db->commit();
        } catch (Throwable $e) { $this->db->rollBack(); throw $e; }
    }
    public function roles(string $steamid): array {
        self::steamId($steamid);
        $stmt = $this->db->prepare('SELECT role FROM cloudhub_player_roles WHERE steamid=? ORDER BY role');
        $stmt->execute([$steamid]);
        return $stmt->fetchAll(PDO::FETCH_COLUMN);
    }
    public function can(string $steamid, string $permission): bool {
        $roles = $this->roles($steamid); // Fresh read, never trust roles cached in a session.
        if (in_array('OWNER', $roles, true)) { return true; }
        $stmt = $this->db->prepare('SELECT 1 FROM cloudhub_player_roles r JOIN cloudhub_role_permissions p ON p.role=r.role WHERE r.steamid=? AND p.permission=? LIMIT 1');
        $stmt->execute([$steamid,$permission]);
        return $stmt->fetchColumn() !== false;
    }
    /** Private account response, only call after authenticating the same SteamID. */
    public function account(string $steamid): ?array {
        self::steamId($steamid);
        $stmt = $this->db->prepare('SELECT p.steamid,p.nickname,p.avatar_url,p.first_seen_at,p.last_seen_at,w.balance,s.rp FROM cloudhub_players p JOIN cloudhub_wallets w USING(steamid) JOIN cloudhub_player_stats s USING(steamid) WHERE p.steamid=?');
        $stmt->execute([$steamid]);
        $account = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$account) { return null; }
        // BIGINT values are decimal strings in JSON to preserve precision in JS/C#.
        $account['balance'] = (string)$account['balance'];
        $account['rp'] = (string)$account['rp'];
        $account['roles'] = $this->roles($steamid);
        $rank = $this->db->prepare('SELECT rank_key,name,min_rp,color,icon FROM cloudhub_rank_config WHERE min_rp<=? ORDER BY min_rp DESC LIMIT 1');
        $rank->execute([$account['rp']]);
        $account['rank'] = $rank->fetch(PDO::FETCH_ASSOC) ?: null;
        $next = $this->db->prepare('SELECT rank_key,name,min_rp,color,icon FROM cloudhub_rank_config WHERE min_rp>? ORDER BY min_rp LIMIT 1');
        $next->execute([$account['rp']]);
        $account['next_rank'] = $next->fetch(PDO::FETCH_ASSOC) ?: null;
        foreach (['rank','next_rank'] as $field) {
            if ($account[$field]) { $account[$field]['min_rp'] = (string)$account[$field]['min_rp']; }
        }
        return $account;
    }
    /** Session-owned, bounded ledger page. Cursor is a decimal string to preserve BIGINT precision. */
    public function transactions(string $steamid, ?string $before = null): array {
        self::steamId($steamid);
        if ($before !== null && (!preg_match('/^[1-9][0-9]{0,18}$/D',$before) || strlen($before) === 19 && strcmp($before,'9223372036854775807')>0)) { throw new InvalidArgumentException('Invalid cursor'); }
        $sql='SELECT id,amount,balance_before,balance_after,source,reason,created_at FROM cloudhub_wallet_transactions WHERE steamid=?';
        $args=[$steamid];
        if ($before!==null) { $sql.=' AND id<?'; $args[]=$before; }
        $stmt=$this->db->prepare($sql.' ORDER BY id DESC LIMIT 50'); $stmt->execute($args);
        $rows=$stmt->fetchAll(PDO::FETCH_ASSOC);
        foreach ($rows as &$row) foreach (['id','amount','balance_before','balance_after'] as $field) $row[$field]=(string)$row[$field];
        return $rows;
    }
    /** First OWNER only, from an OS-controlled CLI, after a verified Steam login. */
    public function bootstrapOwner(string $steamid, string $reason): void {
        if (PHP_SAPI !== 'cli') { throw new LogicException('CLI only'); }
        self::steamId($steamid);
        if (trim($reason) === '' || strlen($reason) > 500) { throw new InvalidArgumentException('Reason required (max 500 bytes)'); }
        $lock = 'cloudhub-owner-' . substr(hash('sha256',(string)$this->db->query('SELECT DATABASE()')->fetchColumn()),0,32);
        $stmt = $this->db->prepare('SELECT GET_LOCK(?,10)');
        $stmt->execute([$lock]);
        if ((int)$stmt->fetchColumn() !== 1) { throw new RuntimeException('Owner lock unavailable'); }
        try {
            $this->db->beginTransaction();
            if ($this->db->query("SELECT 1 FROM cloudhub_player_roles WHERE role='OWNER' LIMIT 1")->fetchColumn()) { throw new RuntimeException('OWNER already configured; bootstrap is closed'); }
            $stmt = $this->db->prepare('SELECT steam_verified_at FROM cloudhub_players WHERE steamid=? FOR UPDATE');
            $stmt->execute([$steamid]);
            if (!$stmt->fetchColumn()) { throw new RuntimeException('Target must first complete verified Steam login with Core enabled'); }
            $this->db->prepare("INSERT INTO cloudhub_player_roles(steamid,role) VALUES (?,'OWNER')")->execute([$steamid]);
            $this->db->prepare("INSERT INTO cloudhub_admin_audit_logs(target_steamid,action,reason,metadata_json) VALUES (?,'owner.bootstrap',?,?)")->execute([$steamid,$reason,json_encode(['source'=>'local-cli'],JSON_THROW_ON_ERROR)]);
            $this->db->commit();
        } catch (Throwable $e) {
            if ($this->db->inTransaction()) { $this->db->rollBack(); }
            throw $e;
        } finally { $this->db->prepare('SELECT RELEASE_LOCK(?)')->execute([$lock]); }
    }
}
