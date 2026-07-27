<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/class/SessionBootstrap.php';
require_once __DIR__ . '/class/ApiProtect.php';
require_once __DIR__ . '/class/Database.php';

wp_send_cors_headers();
wp_boot_session();

header('Content-Type: application/json');

if (!isset($_SESSION['steamid'])) {
    http_response_code(401);
    echo json_encode(['error' => 'Not logged in']);
    exit;
}

$steamid = (string) $_SESSION['steamid'];
wp_enforce_rate_limit($steamid);

$action = $_POST['action'] ?? $_GET['action'] ?? '';

$readActions = ['list', 'list_public', 'get', 'candidates'];
$writeActions = ['save', 'set_public', 'copy', 'apply', 'delete'];

if (in_array($action, $writeActions, true)) {
    wp_api_bust($steamid);
}

$caching = false;
if (in_array($action, $readActions, true)) {
    $cacheKey = $action . '|' . md5(json_encode([
        'id' => $_POST['id'] ?? $_GET['id'] ?? '',
        'limit' => $_POST['limit'] ?? $_GET['limit'] ?? '',
        'team' => $_POST['team'] ?? '',
    ]));
    if (wp_api_try_send_cache($steamid, $cacheKey)) {
        exit;
    }
    ob_start();
    $caching = true;
    $GLOBALS['__wp_api_cache_key'] = $cacheKey;
    $GLOBALS['__wp_api_cache_steamid'] = $steamid;
}

define('WP_LOADOUT_MAX', 20);
define('WP_LOADOUT_NAME_MAX', 48);

try {
    $db = Database::getInstance()->getConnection();
} catch (Throwable $e) {
    if ($caching && ob_get_level() > 0) {
        ob_end_clean();
    }
    Database::reset();
    http_response_code(503);
    echo json_encode(['error' => 'Database connection failed: ' . $e->getMessage()]);
    exit;
}

function wp_team_code_to_int($team): ?int
{
    if ($team === 'T' || $team === 2 || $team === '2') {
        return 2;
    }
    if ($team === 'CT' || $team === 3 || $team === '3') {
        return 3;
    }
    return null;
}

function wp_normalize_name(string $name): ?string
{
    $name = trim(preg_replace('/\s+/u', ' ', $name) ?? '');
    if ($name === '' || strlen($name) > WP_LOADOUT_NAME_MAX) {
        return null;
    }
    return $name;
}

/** @return array<string,mixed> */
function wp_snapshot_team(PDO $db, string $steamid, int $team): array
{
    $stmt = $db->prepare(
        'SELECT weapon_defindex, weapon_paint_id, weapon_wear, weapon_seed, weapon_nametag,
                weapon_stattrak, weapon_stattrak_count,
                weapon_sticker_0, weapon_sticker_1, weapon_sticker_2, weapon_sticker_3, weapon_sticker_4,
                weapon_keychain
         FROM wp_player_skins WHERE steamid = ? AND weapon_team = ?'
    );
    $stmt->execute([$steamid, $team]);
    $skins = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $stmt = $db->prepare('SELECT knife FROM wp_player_knife WHERE steamid = ? AND weapon_team = ?');
    $stmt->execute([$steamid, $team]);
    $knife = $stmt->fetchColumn();
    $knife = $knife !== false ? (string) $knife : null;

    $stmt = $db->prepare('SELECT weapon_defindex FROM wp_player_gloves WHERE steamid = ? AND weapon_team = ?');
    $stmt->execute([$steamid, $team]);
    $glovesDef = $stmt->fetchColumn();
    $gloves = null;
    if ($glovesDef !== false) {
        $gStmt = $db->prepare(
            'SELECT weapon_paint_id, weapon_wear, weapon_seed FROM wp_player_skins
             WHERE steamid = ? AND weapon_team = ? AND weapon_defindex = ? LIMIT 1'
        );
        $gStmt->execute([$steamid, $team, $glovesDef]);
        $gSkin = $gStmt->fetch(PDO::FETCH_ASSOC) ?: [];
        $gloves = [
            'weapon_defindex' => (int) $glovesDef,
            'weapon_paint_id' => isset($gSkin['weapon_paint_id']) ? (int) $gSkin['weapon_paint_id'] : 0,
            'weapon_wear' => isset($gSkin['weapon_wear']) ? (float) $gSkin['weapon_wear'] : 0.000001,
            'weapon_seed' => isset($gSkin['weapon_seed']) ? (int) $gSkin['weapon_seed'] : 0,
        ];
    }

    $agentCol = $team === 2 ? 'agent_t' : 'agent_ct';
    $stmt = $db->prepare("SELECT `$agentCol` FROM wp_player_agents WHERE steamid = ? LIMIT 1");
    $stmt->execute([$steamid]);
    $agent = $stmt->fetchColumn();
    $agent = ($agent !== false && $agent !== null && $agent !== '') ? (string) $agent : null;

    $musicId = null;
    try {
        $stmt = $db->prepare('SELECT music_id FROM wp_player_music WHERE steamid = ? AND weapon_team = ?');
        $stmt->execute([$steamid, $team]);
        $m = $stmt->fetchColumn();
        if ($m !== false) {
            $musicId = (int) $m;
        }
    } catch (Throwable $e) {
        // table may be empty / unused
    }

    $pinId = null;
    try {
        $stmt = $db->prepare('SELECT id FROM wp_player_pins WHERE steamid = ? AND weapon_team = ?');
        $stmt->execute([$steamid, $team]);
        $p = $stmt->fetchColumn();
        if ($p !== false) {
            $pinId = (int) $p;
        }
    } catch (Throwable $e) {
        // ignore
    }

    return [
        'weapon_team' => $team,
        'skins' => $skins,
        'knife' => $knife,
        'gloves' => $gloves,
        'agent' => $agent,
        'music_id' => $musicId,
        'pin_id' => $pinId,
    ];
}

function wp_apply_team(PDO $db, string $steamid, int $team, array $snapshot): void
{
    // Clear existing team rows then insert snapshot
    $db->prepare('DELETE FROM wp_player_skins WHERE steamid = ? AND weapon_team = ?')->execute([$steamid, $team]);
    $db->prepare('DELETE FROM wp_player_knife WHERE steamid = ? AND weapon_team = ?')->execute([$steamid, $team]);
    $db->prepare('DELETE FROM wp_player_gloves WHERE steamid = ? AND weapon_team = ?')->execute([$steamid, $team]);
    try {
        $db->prepare('DELETE FROM wp_player_music WHERE steamid = ? AND weapon_team = ?')->execute([$steamid, $team]);
    } catch (Throwable $e) {
    }
    try {
        $db->prepare('DELETE FROM wp_player_pins WHERE steamid = ? AND weapon_team = ?')->execute([$steamid, $team]);
    } catch (Throwable $e) {
    }

    $skins = $snapshot['skins'] ?? [];
    if (is_array($skins)) {
        $ins = $db->prepare(
            'INSERT INTO wp_player_skins (
                steamid, weapon_team, weapon_defindex, weapon_paint_id, weapon_wear, weapon_seed,
                weapon_nametag, weapon_stattrak, weapon_stattrak_count,
                weapon_sticker_0, weapon_sticker_1, weapon_sticker_2, weapon_sticker_3, weapon_sticker_4,
                weapon_keychain
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        foreach ($skins as $row) {
            if (!isset($row['weapon_defindex'])) {
                continue;
            }
            $ins->execute([
                $steamid,
                $team,
                (int) $row['weapon_defindex'],
                (int) ($row['weapon_paint_id'] ?? 0),
                (float) ($row['weapon_wear'] ?? 0.000001),
                (int) ($row['weapon_seed'] ?? 0),
                $row['weapon_nametag'] ?? null,
                (int) ($row['weapon_stattrak'] ?? 0),
                (int) ($row['weapon_stattrak_count'] ?? 0),
                $row['weapon_sticker_0'] ?? '0;0;0;0;0;0;0',
                $row['weapon_sticker_1'] ?? '0;0;0;0;0;0;0',
                $row['weapon_sticker_2'] ?? '0;0;0;0;0;0;0',
                $row['weapon_sticker_3'] ?? '0;0;0;0;0;0;0',
                $row['weapon_sticker_4'] ?? '0;0;0;0;0;0;0',
                $row['weapon_keychain'] ?? '0;0;0;0;0',
            ]);
        }
    }

    if (!empty($snapshot['knife'])) {
        $db->prepare('INSERT INTO wp_player_knife (steamid, weapon_team, knife) VALUES (?, ?, ?)')
            ->execute([$steamid, $team, (string) $snapshot['knife']]);
    }

    $gloves = $snapshot['gloves'] ?? null;
    if (is_array($gloves) && isset($gloves['weapon_defindex'])) {
        $def = (int) $gloves['weapon_defindex'];
        $db->prepare('INSERT INTO wp_player_gloves (steamid, weapon_team, weapon_defindex) VALUES (?, ?, ?)')
            ->execute([$steamid, $team, $def]);
        // gloves skin may already be in skins list; ensure paint row exists
        $chk = $db->prepare(
            'SELECT COUNT(*) FROM wp_player_skins WHERE steamid = ? AND weapon_team = ? AND weapon_defindex = ?'
        );
        $chk->execute([$steamid, $team, $def]);
        if ((int) $chk->fetchColumn() === 0) {
            $db->prepare(
                'INSERT INTO wp_player_skins (steamid, weapon_team, weapon_defindex, weapon_paint_id, weapon_wear, weapon_seed)
                 VALUES (?, ?, ?, ?, ?, ?)'
            )->execute([
                $steamid,
                $team,
                $def,
                (int) ($gloves['weapon_paint_id'] ?? 0),
                (float) ($gloves['weapon_wear'] ?? 0.000001),
                (int) ($gloves['weapon_seed'] ?? 0),
            ]);
        }
    }

    $agentCol = $team === 2 ? 'agent_t' : 'agent_ct';
    $agent = $snapshot['agent'] ?? null;
    if ($agent !== null && $agent !== '') {
        $exists = $db->prepare('SELECT COUNT(*) FROM wp_player_agents WHERE steamid = ?');
        $exists->execute([$steamid]);
        if ((int) $exists->fetchColumn() > 0) {
            $db->prepare("UPDATE wp_player_agents SET `$agentCol` = ? WHERE steamid = ?")
                ->execute([(string) $agent, $steamid]);
        } else {
            if ($team === 2) {
                $db->prepare('INSERT INTO wp_player_agents (steamid, agent_t, agent_ct) VALUES (?, ?, NULL)')
                    ->execute([$steamid, (string) $agent]);
            } else {
                $db->prepare('INSERT INTO wp_player_agents (steamid, agent_t, agent_ct) VALUES (?, NULL, ?)')
                    ->execute([$steamid, (string) $agent]);
            }
        }
    }

    if (isset($snapshot['music_id']) && $snapshot['music_id'] !== null) {
        try {
            $db->prepare('INSERT INTO wp_player_music (steamid, weapon_team, music_id) VALUES (?, ?, ?)')
                ->execute([$steamid, $team, (int) $snapshot['music_id']]);
        } catch (Throwable $e) {
        }
    }
    if (isset($snapshot['pin_id']) && $snapshot['pin_id'] !== null) {
        try {
            $db->prepare('INSERT INTO wp_player_pins (steamid, weapon_team, id) VALUES (?, ?, ?)')
                ->execute([$steamid, $team, (int) $snapshot['pin_id']]);
        } catch (Throwable $e) {
        }
    }
}

/** Pick default thumb from snapshot team. */
function wp_default_thumb_from_team(array $teamSnap): array
{
    $skins = $teamSnap['skins'] ?? [];
    if (is_array($skins) && count($skins) > 0) {
        $row = $skins[0];
        $def = (int) ($row['weapon_defindex'] ?? 0);
        $paint = (int) ($row['weapon_paint_id'] ?? 0);
        return [
            'thumb_defindex' => $def,
            'thumb_paint_id' => $paint,
            'thumb_url' => '',
        ];
    }
    return ['thumb_defindex' => null, 'thumb_paint_id' => null, 'thumb_url' => ''];
}

function wp_parse_public_flag($raw): int
{
    if ($raw === true || $raw === 1 || $raw === '1' || $raw === 'true' || $raw === 'on') {
        return 1;
    }
    return 0;
}

/** Unique name under steamid; keeps within WP_LOADOUT_NAME_MAX. */
function wp_unique_loadout_name(PDO $db, string $steamid, string $desired): string
{
    $base = wp_normalize_name($desired) ?? 'Loadout';
    $candidate = $base;
    $n = 2;
    $chk = $db->prepare('SELECT COUNT(*) FROM wp_saved_loadouts WHERE steamid = ? AND name = ?');
    while (true) {
        $chk->execute([$steamid, $candidate]);
        if ((int) $chk->fetchColumn() === 0) {
            return $candidate;
        }
        $suffix = ' (' . $n . ')';
        $maxBase = WP_LOADOUT_NAME_MAX - strlen($suffix);
        if ($maxBase < 1) {
            $maxBase = 1;
        }
        $candidate = substr($base, 0, $maxBase) . $suffix;
        $n++;
        if ($n > 99) {
            return substr($base, 0, WP_LOADOUT_NAME_MAX - 8) . '-' . substr((string) time(), -6);
        }
    }
}

switch ($action) {
    case 'list': {
        $stmt = $db->prepare(
            'SELECT id, name, scope, weapon_team, is_public, thumb_url, thumb_defindex, thumb_paint_id, created_at, updated_at
             FROM wp_saved_loadouts WHERE steamid = ? ORDER BY updated_at DESC'
        );
        $stmt->execute([$steamid]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        foreach ($rows as &$row) {
            $row['is_public'] = (int) ($row['is_public'] ?? 0);
        }
        unset($row);
        echo json_encode(['loadouts' => $rows]);
        break;
    }

    case 'list_public': {
        $limit = min(80, max(1, (int) ($_POST['limit'] ?? $_GET['limit'] ?? 40)));
        $stmt = $db->prepare(
            'SELECT l.id, l.name, l.scope, l.weapon_team, l.is_public, l.thumb_url, l.thumb_defindex, l.thumb_paint_id,
                    l.steamid, l.created_at, l.updated_at,
                    u.personaname AS owner_name, u.avatarmedium AS owner_avatar
             FROM wp_saved_loadouts l
             LEFT JOIN wp_users_data u ON u.steamid = l.steamid
             WHERE l.is_public = 1 AND l.steamid <> ?
             ORDER BY l.updated_at DESC
             LIMIT ' . (int) $limit
        );
        $stmt->execute([$steamid]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        foreach ($rows as &$row) {
            $row['is_public'] = 1;
            $row['owner_name'] = $row['owner_name'] ?: ('Steam ' . substr((string) $row['steamid'], -5));
            // Don't leak full steamid to clients if not needed - keep for uniqueness key only? Useful for display. OK to keep.
        }
        unset($row);
        echo json_encode(['loadouts' => $rows]);
        break;
    }

    case 'get': {
        $id = (int) ($_POST['id'] ?? $_GET['id'] ?? 0);
        $stmt = $db->prepare(
            'SELECT id, name, scope, weapon_team, is_public, thumb_url, thumb_defindex, thumb_paint_id, payload, created_at, updated_at, steamid
             FROM wp_saved_loadouts WHERE id = ? LIMIT 1'
        );
        $stmt->execute([$id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$row) {
            http_response_code(404);
            echo json_encode(['error' => 'Not found']);
            exit;
        }
        $isOwner = (string) $row['steamid'] === $steamid;
        $isPublic = (int) ($row['is_public'] ?? 0) === 1;
        if (!$isOwner && !$isPublic) {
            http_response_code(404);
            echo json_encode(['error' => 'Not found']);
            exit;
        }
        if (is_string($row['payload'])) {
            $row['payload'] = json_decode($row['payload'], true);
        }
        $row['is_public'] = (int) ($row['is_public'] ?? 0);
        $row['is_owner'] = $isOwner;
        unset($row['steamid']);
        echo json_encode($row);
        break;
    }

    case 'candidates': {
        // skins usable as thumbnails for current scope
        $scope = $_POST['scope'] ?? 'team';
        $team = wp_team_code_to_int($_POST['team'] ?? '');
        $out = [];
        if ($scope === 'both') {
            foreach ([2, 3] as $t) {
                $snap = wp_snapshot_team($db, $steamid, $t);
                foreach ($snap['skins'] as $s) {
                    $out[] = [
                        'weapon_team' => $t,
                        'weapon_defindex' => (int) $s['weapon_defindex'],
                        'weapon_paint_id' => (int) $s['weapon_paint_id'],
                    ];
                }
            }
        } else {
            if ($team === null) {
                http_response_code(400);
                echo json_encode(['error' => 'Invalid team']);
                exit;
            }
            $snap = wp_snapshot_team($db, $steamid, $team);
            foreach ($snap['skins'] as $s) {
                $out[] = [
                    'weapon_team' => $team,
                    'weapon_defindex' => (int) $s['weapon_defindex'],
                    'weapon_paint_id' => (int) $s['weapon_paint_id'],
                ];
            }
        }
        echo json_encode(['skins' => $out]);
        break;
    }

    case 'save': {
        $name = wp_normalize_name((string) ($_POST['name'] ?? ''));
        if ($name === null) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid name']);
            exit;
        }

        $scope = $_POST['scope'] ?? 'team';
        if ($scope !== 'team' && $scope !== 'both') {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid scope']);
            exit;
        }

        $isPublic = wp_parse_public_flag($_POST['is_public'] ?? 0);

        $weaponTeam = null;
        $payload = null;

        if ($scope === 'team') {
            $weaponTeam = wp_team_code_to_int($_POST['team'] ?? '');
            if ($weaponTeam === null) {
                http_response_code(400);
                echo json_encode(['error' => 'Invalid team']);
                exit;
            }
            $payload = [
                'scope' => 'team',
                'team' => wp_snapshot_team($db, $steamid, $weaponTeam),
            ];
        } else {
            $payload = [
                'scope' => 'both',
                't' => wp_snapshot_team($db, $steamid, 2),
                'ct' => wp_snapshot_team($db, $steamid, 3),
            ];
        }

        $thumbUrl = trim((string) ($_POST['thumb_url'] ?? ''));
        $thumbDef = isset($_POST['thumb_defindex']) && $_POST['thumb_defindex'] !== ''
            ? (int) $_POST['thumb_defindex'] : null;
        $thumbPaint = isset($_POST['thumb_paint_id']) && $_POST['thumb_paint_id'] !== ''
            ? (int) $_POST['thumb_paint_id'] : null;

        if ($thumbUrl === '' && ($thumbDef === null || $thumbPaint === null)) {
            $fallback = $scope === 'both'
                ? wp_default_thumb_from_team($payload['t'])
                : wp_default_thumb_from_team($payload['team']);
            $thumbDef = $fallback['thumb_defindex'];
            $thumbPaint = $fallback['thumb_paint_id'];
            $thumbUrl = $fallback['thumb_url'];
        }
        if ($thumbUrl === '') {
            $thumbUrl = 'pending';
        }
        if (strlen($thumbUrl) > 512) {
            $thumbUrl = substr($thumbUrl, 0, 512);
        }

        $cntStmt = $db->prepare('SELECT COUNT(*) FROM wp_saved_loadouts WHERE steamid = ?');
        $cntStmt->execute([$steamid]);
        $count = (int) $cntStmt->fetchColumn();

        $existing = $db->prepare('SELECT id FROM wp_saved_loadouts WHERE steamid = ? AND name = ? LIMIT 1');
        $existing->execute([$steamid, $name]);
        $existingId = $existing->fetchColumn();

        if ($existingId === false && $count >= WP_LOADOUT_MAX) {
            http_response_code(400);
            echo json_encode(['error' => 'Loadout limit reached', 'max' => WP_LOADOUT_MAX]);
            exit;
        }

        $now = date('Y-m-d H:i:s');
        $payloadJson = json_encode($payload, JSON_UNESCAPED_UNICODE);

        if ($existingId !== false) {
            $db->prepare(
                'UPDATE wp_saved_loadouts SET scope = ?, weapon_team = ?, is_public = ?, thumb_url = ?, thumb_defindex = ?,
                 thumb_paint_id = ?, payload = ?, updated_at = ? WHERE id = ? AND steamid = ?'
            )->execute([
                $scope,
                $weaponTeam,
                $isPublic,
                $thumbUrl,
                $thumbDef,
                $thumbPaint,
                $payloadJson,
                $now,
                (int) $existingId,
                $steamid,
            ]);
            $id = (int) $existingId;
        } else {
            $db->prepare(
                'INSERT INTO wp_saved_loadouts
                 (steamid, name, scope, weapon_team, is_public, thumb_url, thumb_defindex, thumb_paint_id, payload, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
            )->execute([
                $steamid,
                $name,
                $scope,
                $weaponTeam,
                $isPublic,
                $thumbUrl,
                $thumbDef,
                $thumbPaint,
                $payloadJson,
                $now,
                $now,
            ]);
            $id = (int) $db->lastInsertId();
        }

        echo json_encode([
            'success' => true,
            'id' => $id,
            'name' => $name,
            'scope' => $scope,
            'weapon_team' => $weaponTeam,
            'is_public' => $isPublic,
            'thumb_url' => $thumbUrl,
            'thumb_defindex' => $thumbDef,
            'thumb_paint_id' => $thumbPaint,
        ]);
        break;
    }

    case 'set_public': {
        $id = (int) ($_POST['id'] ?? 0);
        $isPublic = wp_parse_public_flag($_POST['is_public'] ?? 0);
        $now = date('Y-m-d H:i:s');
        $stmt = $db->prepare(
            'UPDATE wp_saved_loadouts SET is_public = ?, updated_at = ? WHERE id = ? AND steamid = ?'
        );
        $stmt->execute([$isPublic, $now, $id, $steamid]);
        if ($stmt->rowCount() === 0) {
            // verify ownership (rowCount 0 also when value unchanged)
            $chk = $db->prepare('SELECT id FROM wp_saved_loadouts WHERE id = ? AND steamid = ? LIMIT 1');
            $chk->execute([$id, $steamid]);
            if (!$chk->fetchColumn()) {
                http_response_code(404);
                echo json_encode(['error' => 'Not found']);
                exit;
            }
        }
        echo json_encode(['success' => true, 'id' => $id, 'is_public' => $isPublic]);
        break;
    }

    case 'copy': {
        $id = (int) ($_POST['id'] ?? 0);
        $stmt = $db->prepare(
            'SELECT id, name, scope, weapon_team, is_public, thumb_url, thumb_defindex, thumb_paint_id, payload, steamid
             FROM wp_saved_loadouts WHERE id = ? LIMIT 1'
        );
        $stmt->execute([$id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$row) {
            http_response_code(404);
            echo json_encode(['error' => 'Not found']);
            exit;
        }
        $isOwner = (string) $row['steamid'] === $steamid;
        $isPublic = (int) ($row['is_public'] ?? 0) === 1;
        if (!$isOwner && !$isPublic) {
            http_response_code(403);
            echo json_encode(['error' => 'Loadout is not public']);
            exit;
        }

        $cntStmt = $db->prepare('SELECT COUNT(*) FROM wp_saved_loadouts WHERE steamid = ?');
        $cntStmt->execute([$steamid]);
        if ((int) $cntStmt->fetchColumn() >= WP_LOADOUT_MAX) {
            http_response_code(400);
            echo json_encode(['error' => 'Loadout limit reached', 'max' => WP_LOADOUT_MAX]);
            exit;
        }

        $customName = wp_normalize_name((string) ($_POST['name'] ?? ''));
        $desired = $customName !== null
            ? $customName
            : ((string) $row['name'] . ' copy');
        $newName = wp_unique_loadout_name($db, $steamid, $desired);

        $payload = $row['payload'];
        if (is_array($payload)) {
            $payloadJson = json_encode($payload, JSON_UNESCAPED_UNICODE);
        } else {
            $payloadJson = (string) $payload;
        }

        $now = date('Y-m-d H:i:s');
        $db->prepare(
            'INSERT INTO wp_saved_loadouts
             (steamid, name, scope, weapon_team, is_public, thumb_url, thumb_defindex, thumb_paint_id, payload, created_at, updated_at)
             VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)'
        )->execute([
            $steamid,
            $newName,
            $row['scope'],
            $row['weapon_team'],
            $row['thumb_url'],
            $row['thumb_defindex'],
            $row['thumb_paint_id'],
            $payloadJson,
            $now,
            $now,
        ]);
        $newId = (int) $db->lastInsertId();

        echo json_encode([
            'success' => true,
            'id' => $newId,
            'name' => $newName,
            'is_public' => 0,
            'copied_from' => $id,
        ]);
        break;
    }

    case 'apply': {
        $id = (int) ($_POST['id'] ?? 0);
        $stmt = $db->prepare(
            'SELECT id, scope, weapon_team, payload FROM wp_saved_loadouts WHERE id = ? AND steamid = ? LIMIT 1'
        );
        $stmt->execute([$id, $steamid]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$row) {
            http_response_code(404);
            echo json_encode(['error' => 'Not found']);
            exit;
        }
        $payload = is_string($row['payload']) ? json_decode($row['payload'], true) : $row['payload'];
        if (!is_array($payload)) {
            http_response_code(500);
            echo json_encode(['error' => 'Corrupt payload']);
            exit;
        }

        try {
            $db->beginTransaction();
            if (($row['scope'] ?? '') === 'both' || ($payload['scope'] ?? '') === 'both') {
                wp_apply_team($db, $steamid, 2, $payload['t'] ?? []);
                wp_apply_team($db, $steamid, 3, $payload['ct'] ?? []);
            } else {
                $team = (int) ($row['weapon_team'] ?? ($payload['team']['weapon_team'] ?? 0));
                if ($team !== 2 && $team !== 3) {
                    throw new RuntimeException('Invalid team in loadout');
                }
                wp_apply_team($db, $steamid, $team, $payload['team'] ?? $payload);
            }
            $db->commit();
        } catch (Throwable $e) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }
            http_response_code(500);
            echo json_encode(['error' => 'Apply failed: ' . $e->getMessage()]);
            exit;
        }

        echo json_encode(['success' => true]);
        break;
    }

    case 'delete': {
        $id = (int) ($_POST['id'] ?? 0);
        $stmt = $db->prepare('DELETE FROM wp_saved_loadouts WHERE id = ? AND steamid = ?');
        $stmt->execute([$id, $steamid]);
        echo json_encode(['success' => true, 'deleted' => $stmt->rowCount()]);
        break;
    }

    default:
        if ($caching && ob_get_level() > 0) {
            ob_end_clean();
        }
        http_response_code(400);
        echo json_encode(['error' => 'Invalid action']);
        exit;
}

if ($caching) {
    wp_api_end_read_cache();
}
