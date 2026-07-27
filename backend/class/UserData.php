<?php

require_once __DIR__ . '/Database.php';

/**
 * Persist Steam profile + login meta into wp_users_data.
 */
class UserData
{
    public static function clientIp(): ?string
    {
        $candidates = [
            $_SERVER['HTTP_CF_CONNECTING_IP'] ?? null,
            $_SERVER['HTTP_X_FORWARDED_FOR'] ?? null,
            $_SERVER['REMOTE_ADDR'] ?? null,
        ];
        foreach ($candidates as $raw) {
            if (!$raw) {
                continue;
            }
            $ip = trim(explode(',', $raw)[0]);
            if (filter_var($ip, FILTER_VALIDATE_IP)) {
                return $ip;
            }
        }
        return null;
    }

    public static function userAgent(): ?string
    {
        $ua = $_SERVER['HTTP_USER_AGENT'] ?? null;
        if (!$ua) {
            return null;
        }
        return substr($ua, 0, 512);
    }

    /** @return array<string,mixed>|null */
    public static function fetchSteamPlayer(string $steamid): ?array
    {
        if (!defined('STEAM_API_KEY') || STEAM_API_KEY === '') {
            return null;
        }
        $url = 'https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key='
            . urlencode(STEAM_API_KEY) . '&steamids=' . urlencode($steamid);

        $ctx = stream_context_create([
            'http' => [
                'timeout' => 6,
                'ignore_errors' => true,
            ],
        ]);
        $response = @file_get_contents($url, false, $ctx);
        if ($response === false) {
            return null;
        }
        $data = json_decode($response, true);
        return $data['response']['players'][0] ?? null;
    }

    /**
     * Upsert profile from Steam (+ bump login counters when $bumpLogin).
     * @return array<string,mixed>|null row-ish profile for API
     */
    public static function upsertFromSteam(string $steamid, bool $bumpLogin = false): ?array
    {
        $player = self::fetchSteamPlayer($steamid);
        try {
            $db = Database::getInstance()->getConnection();
        } catch (Throwable $e) {
            return $player ? self::normalizePlayer($player) : null;
        }

        $now = date('Y-m-d H:i:s');
        $ip = self::clientIp();
        $ua = self::userAgent();

        $stmt = $db->prepare('SELECT steamid, login_count, first_login_at FROM wp_users_data WHERE steamid = ? LIMIT 1');
        $stmt->execute([$steamid]);
        $existing = $stmt->fetch(PDO::FETCH_ASSOC);

        $fields = [
            'personaname' => $player['personaname'] ?? null,
            'profileurl' => $player['profileurl'] ?? null,
            'avatar' => $player['avatar'] ?? null,
            'avatarmedium' => $player['avatarmedium'] ?? null,
            'avatarfull' => $player['avatarfull'] ?? null,
            'realname' => $player['realname'] ?? null,
            'loccountrycode' => $player['loccountrycode'] ?? null,
            'locstatecode' => $player['locstatecode'] ?? null,
            'loccityid' => isset($player['loccityid']) ? (int) $player['loccityid'] : null,
            'persona_state' => isset($player['personastate']) ? (int) $player['personastate'] : null,
            'communityvisibilitystate' => isset($player['communityvisibilitystate']) ? (int) $player['communityvisibilitystate'] : null,
            'profilestate' => isset($player['profilestate']) ? (int) $player['profilestate'] : null,
            'timecreated' => isset($player['timecreated']) ? (int) $player['timecreated'] : null,
            'lastlogoff' => isset($player['lastlogoff']) ? (int) $player['lastlogoff'] : null,
            'primaryclanid' => $player['primaryclanid'] ?? null,
            'gameextrainfo' => $player['gameextrainfo'] ?? null,
            'gameid' => $player['gameid'] ?? null,
            'updated_at' => $now,
        ];

        if ($existing) {
            $loginCount = (int) $existing['login_count'];
            $sets = [];
            $params = [];
            foreach ($fields as $col => $val) {
                $sets[] = "`$col` = ?";
                $params[] = $val;
            }
            if ($bumpLogin) {
                $sets[] = '`last_login_at` = ?';
                $params[] = $now;
                $sets[] = '`login_count` = ?';
                $params[] = $loginCount + 1;
                $sets[] = '`last_ip` = ?';
                $params[] = $ip;
                $sets[] = '`last_user_agent` = ?';
                $params[] = $ua;
            }
            $params[] = $steamid;
            $sql = 'UPDATE wp_users_data SET ' . implode(', ', $sets) . ' WHERE steamid = ?';
            $db->prepare($sql)->execute($params);
        } else {
            $cols = array_merge(['steamid'], array_keys($fields), [
                'first_login_at',
                'last_login_at',
                'login_count',
                'last_ip',
                'last_user_agent',
                'created_at',
            ]);
            $vals = array_merge(
                [$steamid],
                array_values($fields),
                [$now, $now, $bumpLogin ? 1 : 0, $ip, $ua, $now]
            );
            $placeholders = implode(', ', array_fill(0, count($cols), '?'));
            $colSql = implode(', ', array_map(static fn($c) => "`$c`", $cols));
            $db->prepare("INSERT INTO wp_users_data ($colSql) VALUES ($placeholders)")->execute($vals);
        }

        return self::getCachedProfile($steamid) ?? ($player ? self::normalizePlayer($player) : null);
    }

    /** @return array<string,mixed>|null */
    public static function getCachedProfile(string $steamid): ?array
    {
        try {
            $db = Database::getInstance()->getConnection();
        } catch (Throwable $e) {
            return null;
        }
        $stmt = $db->prepare(
            'SELECT steamid, personaname, profileurl, avatar, avatarmedium, avatarfull,
                    loccountrycode, realname, updated_at
             FROM wp_users_data WHERE steamid = ? LIMIT 1'
        );
        $stmt->execute([$steamid]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$row) {
            return null;
        }
        return [
            'steamid' => $row['steamid'],
            'personaname' => $row['personaname'],
            'avatar' => $row['avatarfull'] ?: ($row['avatarmedium'] ?: $row['avatar']),
            'profileurl' => $row['profileurl'],
            'loccountrycode' => $row['loccountrycode'],
            'realname' => $row['realname'],
            'cached_at' => $row['updated_at'],
        ];
    }

    /** Refresh if missing or older than $maxAgeSec. */
    public static function getOrRefresh(string $steamid, int $maxAgeSec = 3600): ?array
    {
        $cached = self::getCachedProfile($steamid);
        if ($cached && !empty($cached['cached_at'])) {
            $age = time() - strtotime((string) $cached['cached_at']);
            if ($age >= 0 && $age < $maxAgeSec && !empty($cached['personaname'])) {
                return $cached;
            }
        }
        return self::upsertFromSteam($steamid, false) ?? $cached;
    }

    /** @param array<string,mixed> $player */
    private static function normalizePlayer(array $player): array
    {
        return [
            'steamid' => $player['steamid'] ?? null,
            'personaname' => $player['personaname'] ?? null,
            'avatar' => $player['avatarfull'] ?? ($player['avatarmedium'] ?? ($player['avatar'] ?? null)),
            'profileurl' => $player['profileurl'] ?? null,
            'loccountrycode' => $player['loccountrycode'] ?? null,
            'realname' => $player['realname'] ?? null,
        ];
    }
}
