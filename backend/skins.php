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

$steamid = $_SESSION['steamid'];
wp_enforce_rate_limit((string) $steamid);

$teamRaw = $_POST['team'] ?? '';
$action = $_POST['action'] ?? '';

// reset_both clears T+CT and does not need a single team
if ($action === 'reset_both') {
    $team = 0;
} elseif ($teamRaw === 'CT') {
    $team = 3;
} elseif ($teamRaw === 'T') {
    $team = 2;
} else {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid team']);
    exit;
}

$readActions = ['bootstrap', 'bootstrap_both', 'getall', 'gloves_addon_data', 'agent_get'];
$writeActions = [
    'save',
    'reset',
    'reset_team',
    'reset_both',
    'music_save',
    'pin_save',
    'gloves_save',
    'agent_save',
];

if (in_array($action, $writeActions, true)) {
    wp_api_bust((string) $steamid);
}

$caching = false;
if (in_array($action, $readActions, true)) {
    $cacheKey = $action . '|t=' . $team;
    if (wp_api_try_send_cache((string) $steamid, $cacheKey)) {
        exit;
    }
    ob_start();
    $caching = true;
    $GLOBALS['__wp_api_cache_key'] = $cacheKey;
    $GLOBALS['__wp_api_cache_steamid'] = (string) $steamid;
}

try {
    $db = Database::getInstance()->getConnection();
} catch (Throwable $e) {
    if ($caching && ob_get_level() > 0) {
        ob_end_clean();
    }
    Database::reset();
    http_response_code(503);
    echo json_encode([
        'errorDB' => 'Database connection failed: ' . $e->getMessage(),
        'hint' => 'Empty tables are OK (plugin does not seed). Check MySQL reachability / config.php.',
    ]);
    exit;
}
if (!$db) {
    if ($caching && ob_get_level() > 0) {
        ob_end_clean();
    }
    http_response_code(500);
    echo json_encode(['errorDB' => 'Database connection failed remember to set up data in config.php']);
    exit;
}
switch ($action) {
    case 'getall':
        // Pobranie skinów dla danego steamid i teamu
        $stmt = $db->prepare("SELECT weapon_defindex,
            weapon_paint_id,
            weapon_wear,
            weapon_seed,
            weapon_nametag,
            weapon_stattrak,
            weapon_stattrak_count,
            weapon_sticker_0,
            weapon_sticker_1,
            weapon_sticker_2,
            weapon_sticker_3,
            weapon_sticker_4,
            weapon_keychain FROM wp_player_skins WHERE steamid = ? AND weapon_team = ?");
        $stmt->execute([$steamid, $team]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode($rows);
        break;

    case 'bootstrap': {
        // One HTTP request / one DB connection for page load (knife + skins + agents + gloves).
        // Avoids 4 parallel PHP workers each opening remote MySQL (LH timeouts).
        $knifeStmt = $db->prepare(
            'SELECT knife FROM wp_player_knife WHERE steamid = ? AND weapon_team = ?'
        );
        $knifeStmt->execute([$steamid, $team]);
        $knife = $knifeStmt->fetchColumn();

        $skinsStmt = $db->prepare(
            'SELECT weapon_defindex, weapon_paint_id, weapon_wear, weapon_seed, weapon_nametag,
                    weapon_stattrak, weapon_stattrak_count,
                    weapon_sticker_0, weapon_sticker_1, weapon_sticker_2, weapon_sticker_3, weapon_sticker_4,
                    weapon_keychain
             FROM wp_player_skins WHERE steamid = ? AND weapon_team = ?'
        );
        $skinsStmt->execute([$steamid, $team]);
        $skins = $skinsStmt->fetchAll(PDO::FETCH_ASSOC);

        $agentStmt = $db->prepare('SELECT agent_t, agent_ct FROM wp_player_agents WHERE steamid = ?');
        $agentStmt->execute([$steamid]);
        $agents = $agentStmt->fetch(PDO::FETCH_ASSOC) ?: ['agent_t' => null, 'agent_ct' => null];

        $gModelsStmt = $db->prepare(
            'SELECT weapon_team, weapon_defindex FROM wp_player_gloves WHERE steamid = ?'
        );
        $gModelsStmt->execute([$steamid]);
        $gloves_models = $gModelsStmt->fetchAll(PDO::FETCH_ASSOC);

        $gloves_skins = [];
        if (count($gloves_models) > 0) {
            // Single query instead of N+1 per glove model
            $gSkinsStmt = $db->prepare(
                'SELECT s.weapon_team, s.weapon_defindex, s.weapon_paint_id, s.weapon_wear, s.weapon_seed
                 FROM wp_player_gloves g
                 INNER JOIN wp_player_skins s
                   ON s.steamid = g.steamid
                  AND s.weapon_team = g.weapon_team
                  AND s.weapon_defindex = g.weapon_defindex
                 WHERE g.steamid = ?'
            );
            $gSkinsStmt->execute([$steamid]);
            $gloves_skins = $gSkinsStmt->fetchAll(PDO::FETCH_ASSOC);
        }

        $musicId = null;
        $musicStmt = $db->prepare(
            'SELECT music_id FROM wp_player_music WHERE steamid = ? AND weapon_team = ? LIMIT 1'
        );
        $musicStmt->execute([$steamid, $team]);
        $m = $musicStmt->fetchColumn();
        if ($m !== false && $m !== null) {
            $musicId = (int) $m;
        }

        $pinId = null;
        $pinStmt = $db->prepare(
            'SELECT id FROM wp_player_pins WHERE steamid = ? AND weapon_team = ? LIMIT 1'
        );
        $pinStmt->execute([$steamid, $team]);
        $p = $pinStmt->fetchColumn();
        if ($p !== false && $p !== null) {
            $pinId = (int) $p;
        }

        echo json_encode([
            'knife' => $knife ?: 'weapon_knife',
            'skins' => $skins,
            'agents' => $agents,
            'gloves' => [
                'gloves_models' => $gloves_models,
                'gloves_skins' => $gloves_skins,
            ],
            'music_id' => $musicId,
            'pin_id' => $pinId,
        ]);
        break;
    }

    case 'bootstrap_both': {
        // Full loadout modal: both teams in one connection.
        $out = ['agents' => null, 't' => null, 'ct' => null, 'gloves' => null];

        $agentStmt = $db->prepare('SELECT agent_t, agent_ct FROM wp_player_agents WHERE steamid = ?');
        $agentStmt->execute([$steamid]);
        $out['agents'] = $agentStmt->fetch(PDO::FETCH_ASSOC) ?: ['agent_t' => null, 'agent_ct' => null];

        $knifeStmt = $db->prepare(
            'SELECT knife FROM wp_player_knife WHERE steamid = ? AND weapon_team = ?'
        );
        $skinsStmt = $db->prepare(
            'SELECT weapon_defindex, weapon_paint_id, weapon_wear, weapon_seed, weapon_nametag,
                    weapon_stattrak, weapon_stattrak_count,
                    weapon_sticker_0, weapon_sticker_1, weapon_sticker_2, weapon_sticker_3, weapon_sticker_4,
                    weapon_keychain
             FROM wp_player_skins WHERE steamid = ? AND weapon_team = ?'
        );

        foreach ([2 => 't', 3 => 'ct'] as $teamId => $key) {
            $knifeStmt->execute([$steamid, $teamId]);
            $knife = $knifeStmt->fetchColumn();
            $skinsStmt->execute([$steamid, $teamId]);

            $musicId = null;
            $musicStmt = $db->prepare(
                'SELECT music_id FROM wp_player_music WHERE steamid = ? AND weapon_team = ? LIMIT 1'
            );
            $musicStmt->execute([$steamid, $teamId]);
            $m = $musicStmt->fetchColumn();
            if ($m !== false && $m !== null) {
                $musicId = (int) $m;
            }

            $pinId = null;
            $pinStmt = $db->prepare(
                'SELECT id FROM wp_player_pins WHERE steamid = ? AND weapon_team = ? LIMIT 1'
            );
            $pinStmt->execute([$steamid, $teamId]);
            $p = $pinStmt->fetchColumn();
            if ($p !== false && $p !== null) {
                $pinId = (int) $p;
            }

            $out[$key] = [
                'knife' => $knife ?: 'weapon_knife',
                'skins' => $skinsStmt->fetchAll(PDO::FETCH_ASSOC),
                'music_id' => $musicId,
                'pin_id' => $pinId,
            ];
        }

        $gModelsStmt = $db->prepare(
            'SELECT weapon_team, weapon_defindex FROM wp_player_gloves WHERE steamid = ?'
        );
        $gModelsStmt->execute([$steamid]);
        $gloves_models = $gModelsStmt->fetchAll(PDO::FETCH_ASSOC);
        $gloves_skins = [];
        if (count($gloves_models) > 0) {
            $gSkinsStmt = $db->prepare(
                'SELECT s.weapon_team, s.weapon_defindex, s.weapon_paint_id, s.weapon_wear, s.weapon_seed
                 FROM wp_player_gloves g
                 INNER JOIN wp_player_skins s
                   ON s.steamid = g.steamid
                  AND s.weapon_team = g.weapon_team
                  AND s.weapon_defindex = g.weapon_defindex
                 WHERE g.steamid = ?'
            );
            $gSkinsStmt->execute([$steamid]);
            $gloves_skins = $gSkinsStmt->fetchAll(PDO::FETCH_ASSOC);
        }
        $out['gloves'] = [
            'gloves_models' => $gloves_models,
            'gloves_skins' => $gloves_skins,
        ];

        echo json_encode($out);
        break;
    }

        case 'save':
            $weapon_defindex = $_POST['weapon_defindex'] ?? '';
            $paint = $_POST['paint'] ?? 0;
            $wear = $_POST['wear'] ?? 0;
            $seed = $_POST['seed'] ?? 0;
            $nametag = $_POST['nametag'] ?? null;
            $stattrak = intval($_POST['stattrak'] ?? 0) ? 1 : 0;
            $stattrakcount = max(0, intval($_POST['stattrak_count'] ?? 0));
            if ($stattrak === 0) {
                $stattrakcount = 0;
            }
            $keychainId = $_POST['keychainId'] ?? 0;
            $offsetX = $_POST['offsetX'] ?? 0;
            $offsetY = $_POST['offsetY'] ?? 0;
            $offsetZ = $_POST['offsetZ'] ?? 0;
            $keychainSeed = $_POST['keychainSeed'] ?? 0;

            // STICKER FORMAT: id;schema;x;y;wear;scale;rotation (5 slots)
            // Accept full string or bare id (legacy clients).
            $stickerFields = [];
            for ($i = 0; $i < 5; $i++) {
                $raw = $_POST["weapon_sticker_$i"] ?? '0;0;0;0;0;0;0';
                $raw = is_string($raw) ? trim($raw) : strval($raw);
                if ($raw === '' || $raw === '0') {
                    $stickerFields[] = '0;0;0;0;0;0;0';
                    continue;
                }
                if (strpos($raw, ';') !== false) {
                    $parts = explode(';', $raw);
                    $id = intval($parts[0] ?? 0);
                    if ($id <= 0) {
                        $stickerFields[] = '0;0;0;0;0;0;0';
                        continue;
                    }
                    $schema = floatval($parts[1] ?? 0);
                    $sx = floatval($parts[2] ?? 0);
                    $sy = floatval($parts[3] ?? 0);
                    $swear = floatval($parts[4] ?? 0);
                    $scale = isset($parts[5]) && $parts[5] !== '' ? floatval($parts[5]) : 1.0;
                    $rotation = floatval($parts[6] ?? 0);
                    $stickerFields[] = "$id;$schema;$sx;$sy;$swear;$scale;$rotation";
                } else {
                    $id = intval($raw);
                    $stickerFields[] = $id > 0 ? "$id;0;0;0;0;1;0" : '0;0;0;0;0;0;0';
                }
            }

            // KEYCHAIN FORMAT: id;x;y;0;0
            $keychainField = "$keychainId;$offsetX;$offsetY;$offsetZ;$keychainSeed";

            // Sprawdź czy wpis istnieje (update or insert)
            $stmt = $db->prepare("SELECT COUNT(*) FROM wp_player_skins WHERE steamid = ? AND weapon_team = ? AND weapon_defindex = ?");
            $stmt->execute([$steamid, $team, $weapon_defindex]);
            $exists = $stmt->fetchColumn() > 0;

            if ($exists) {
                $stmt = $db->prepare("UPDATE wp_player_skins SET
                    weapon_paint_id = ?,
                    weapon_wear = ?,
                    weapon_seed = ?,
                    weapon_nametag = ?,
                    weapon_stattrak = ?,
                    weapon_stattrak_count = ?,
                    weapon_sticker_0 = ?,
                    weapon_sticker_1 = ?,
                    weapon_sticker_2 = ?,
                    weapon_sticker_3 = ?,
                    weapon_sticker_4 = ?,
                    weapon_keychain = ?
                    WHERE steamid = ? AND weapon_team = ? AND weapon_defindex = ?");
                $stmt->execute([
                    $paint,
                    $wear,
                    $seed,
                    $nametag,
                    $stattrak,
                    $stattrakcount,
                    $stickerFields[0],
                    $stickerFields[1],
                    $stickerFields[2],
                    $stickerFields[3],
                    $stickerFields[4],
                    $keychainField,
                    $steamid,
                    $team,
                    $weapon_defindex
                ]);
            } else {
                $stmt = $db->prepare("INSERT INTO wp_player_skins (
                    steamid, weapon_team, weapon_defindex,
                    weapon_paint_id, weapon_wear, weapon_seed,
                    weapon_nametag, weapon_stattrak, weapon_stattrak_count,
                    weapon_sticker_0, weapon_sticker_1, weapon_sticker_2, weapon_sticker_3, weapon_sticker_4,
                    weapon_keychain
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
                $stmt->execute([
                    $steamid, $team, $weapon_defindex,
                    $paint, $wear, $seed,
                    $nametag, $stattrak, $stattrakcount,
                    $stickerFields[0], $stickerFields[1], $stickerFields[2], $stickerFields[3], $stickerFields[4],
                    $keychainField
                ]);
            }

            echo json_encode(['success' => true]);
    break;
    case 'agent_save':
        $agent_model = $_POST['agent_model'] ?? 0;
        $agent_team = $_POST['agent_team'] ?? 0;
        $row_name = "agent_team";
        if($agent_team == 2){
            $row_name = "agent_t";
        }elseif($agent_team == 3) {
            $row_name = "agent_ct";
        }else{
            http_response_code(400);
            echo json_encode(['error' => 'Invalid agent team ' . $agent_team]);
            exit;
        }
        //check if steamid already has an agent
        $stmt = $db->prepare("SELECT COUNT(*) FROM wp_player_agents WHERE steamid = ?");
        $stmt->execute([$steamid]);
        $exists = $stmt->fetchColumn() > 0;

        if ($exists) {
            $stmt = $db->prepare("UPDATE wp_player_agents SET $row_name = ? WHERE steamid = ?");
            $stmt->execute([$agent_model, $steamid]);
        } else {
            $stmt = $db->prepare("INSERT INTO wp_player_agents (steamid, $row_name) VALUES (?, ?)");
            $stmt->execute([$steamid, $agent_model]);
        }
        echo json_encode(['success' => true]);
        break;
    case 'agent_get':
        $stmt = $db->prepare("SELECT agent_t, agent_ct FROM wp_player_agents WHERE steamid = ?");
        $stmt->execute([$steamid]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($row) {
            echo json_encode($row);
        } else {
            // Pusta tabela / brak wiersza = domyślni agenci (jak świeży start pluginu)
            echo json_encode(['agent_t' => null, 'agent_ct' => null]);
        }
        break;
    case 'gloves_addon_data':
        // 1. Pobierz modele rękawic dla gracza
        $stmt = $db->prepare("SELECT weapon_team, weapon_defindex FROM wp_player_gloves WHERE steamid = ?");
        $stmt->execute([$steamid]);
        $gloves_models = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $gloves_skins = [];
        if (count($gloves_models) > 0) {
            $stmt = $db->prepare(
                'SELECT s.weapon_team, s.weapon_defindex, s.weapon_paint_id, s.weapon_wear, s.weapon_seed
                 FROM wp_player_gloves g
                 INNER JOIN wp_player_skins s
                   ON s.steamid = g.steamid
                  AND s.weapon_team = g.weapon_team
                  AND s.weapon_defindex = g.weapon_defindex
                 WHERE g.steamid = ?'
            );
            $stmt->execute([$steamid]);
            $gloves_skins = $stmt->fetchAll(PDO::FETCH_ASSOC);
        }

        echo json_encode([
            'gloves_models' => $gloves_models,
            'gloves_skins' => $gloves_skins
        ]);
        break;
    case 'gloves_save':
        $weapon_defindex = $_POST['weapon_defindex'] ?? '';
        $paint = $_POST['paint'] ?? 0;
        $wear = $_POST['wear'] ?? 0;
        $seed = $_POST['seed'] ?? 0;
        //check if gloves already exist for this steamid and team in wp_player_gloves
        $stmt = $db->prepare("SELECT COUNT(*) FROM wp_player_gloves WHERE steamid = ? AND weapon_team = ?");
        $stmt->execute([$steamid, $team]);
        $exists = $stmt->fetchColumn() > 0;
        if ($exists) {
            $stmt = $db->prepare("UPDATE wp_player_gloves SET weapon_defindex = ? WHERE steamid = ? AND weapon_team = ?");
            $stmt->execute([$weapon_defindex, $steamid, $team]);
        } else {
            $stmt = $db->prepare("INSERT INTO wp_player_gloves (steamid, weapon_team, weapon_defindex) VALUES (?, ?, ?)");
            $stmt->execute([$steamid, $team, $weapon_defindex]);
        }
        //update PAINT in skins table
        $stmt = $db->prepare("SELECT COUNT(*) FROM wp_player_skins WHERE steamid = ? AND weapon_team = ? AND weapon_defindex = ?");
        $stmt->execute([$steamid, $team, $weapon_defindex]);
        $exists = $stmt->fetchColumn() > 0;
        if ($exists) {
            $stmt = $db->prepare("UPDATE wp_player_skins SET weapon_paint_id = ?, weapon_wear = ?, weapon_seed = ? WHERE steamid = ? AND weapon_team = ? AND weapon_defindex = ?");
            $stmt->execute([$paint, $wear, $seed, $steamid, $team, $weapon_defindex]);
        } else {
            // Insert new skin for gloves
            $stmt = $db->prepare("INSERT INTO wp_player_skins (steamid, weapon_team, weapon_defindex, weapon_paint_id, weapon_wear, weapon_seed) VALUES (?, ?, ?, ?, ?, ?)");
            $stmt->execute([$steamid, $team, $weapon_defindex, $paint, $wear, $seed]);
        }
        // Return success response
        echo json_encode(['success' => true]);
        break;

    case 'reset': {
        // Clear one weapon skin for current team. Does NOT touch saved loadouts.
        $weapon_defindex = intval($_POST['weapon_defindex'] ?? 0);
        if ($weapon_defindex <= 0) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid weapon_defindex']);
            exit;
        }
        $stmt = $db->prepare(
            'DELETE FROM wp_player_skins WHERE steamid = ? AND weapon_team = ? AND weapon_defindex = ?'
        );
        $stmt->execute([$steamid, $team, $weapon_defindex]);
        echo json_encode([
            'success' => true,
            'deleted' => $stmt->rowCount(),
            'weapon_defindex' => $weapon_defindex,
        ]);
        break;
    }

    case 'reset_team': {
        // Clear active skins + team extras. Does NOT touch wp_saved_loadouts.
        $stmt = $db->prepare(
            'DELETE FROM wp_player_skins WHERE steamid = ? AND weapon_team = ?'
        );
        $stmt->execute([$steamid, $team]);
        $deletedSkins = $stmt->rowCount();

        $knifeStmt = $db->prepare(
            'SELECT COUNT(*) FROM wp_player_knife WHERE steamid = ? AND weapon_team = ?'
        );
        $knifeStmt->execute([$steamid, $team]);
        if ($knifeStmt->fetchColumn() > 0) {
            $db->prepare(
                'UPDATE wp_player_knife SET knife = ? WHERE steamid = ? AND weapon_team = ?'
            )->execute(['weapon_knife', $steamid, $team]);
        }

        $db->prepare(
            'DELETE FROM wp_player_gloves WHERE steamid = ? AND weapon_team = ?'
        )->execute([$steamid, $team]);
        $db->prepare(
            'DELETE FROM wp_player_music WHERE steamid = ? AND weapon_team = ?'
        )->execute([$steamid, $team]);
        $db->prepare(
            'DELETE FROM wp_player_pins WHERE steamid = ? AND weapon_team = ?'
        )->execute([$steamid, $team]);

        $agentCol = $team === 2 ? 'agent_t' : 'agent_ct';
        $db->prepare(
            "UPDATE wp_player_agents SET `$agentCol` = NULL WHERE steamid = ?"
        )->execute([$steamid]);

        echo json_encode([
            'success' => true,
            'deleted' => $deletedSkins,
            'loadouts_untouched' => true,
        ]);
        break;
    }

    case 'reset_both': {
        // Clear active skins for T (2) and CT (3). Saved loadouts untouched.
        $stmt = $db->prepare(
            'DELETE FROM wp_player_skins WHERE steamid = ? AND weapon_team IN (2, 3)'
        );
        $stmt->execute([$steamid]);
        $deletedSkins = $stmt->rowCount();

        $knifeStmt = $db->prepare(
            'UPDATE wp_player_knife SET knife = ? WHERE steamid = ? AND weapon_team IN (2, 3)'
        );
        $knifeStmt->execute(['weapon_knife', $steamid]);

        $db->prepare(
            'DELETE FROM wp_player_gloves WHERE steamid = ? AND weapon_team IN (2, 3)'
        )->execute([$steamid]);
        $db->prepare(
            'DELETE FROM wp_player_music WHERE steamid = ? AND weapon_team IN (2, 3)'
        )->execute([$steamid]);
        $db->prepare(
            'DELETE FROM wp_player_pins WHERE steamid = ? AND weapon_team IN (2, 3)'
        )->execute([$steamid]);
        $db->prepare(
            'UPDATE wp_player_agents SET agent_t = NULL, agent_ct = NULL WHERE steamid = ?'
        )->execute([$steamid]);

        echo json_encode([
            'success' => true,
            'deleted' => $deletedSkins,
            'loadouts_untouched' => true,
        ]);
        break;
    }

    case 'music_save': {
        $musicId = intval($_POST['music_id'] ?? 0);
        $both = isset($_POST['both_teams']) && in_array(
            strtolower((string) $_POST['both_teams']),
            ['1', 'true', 'yes', 'on'],
            true
        );
        $teams = $both ? [2, 3] : [$team];
        foreach ($teams as $t) {
            if ($musicId <= 0) {
                $db->prepare(
                    'DELETE FROM wp_player_music WHERE steamid = ? AND weapon_team = ?'
                )->execute([$steamid, $t]);
                continue;
            }
            $exists = $db->prepare(
                'SELECT COUNT(*) FROM wp_player_music WHERE steamid = ? AND weapon_team = ?'
            );
            $exists->execute([$steamid, $t]);
            if ($exists->fetchColumn() > 0) {
                $db->prepare(
                    'UPDATE wp_player_music SET music_id = ? WHERE steamid = ? AND weapon_team = ?'
                )->execute([$musicId, $steamid, $t]);
            } else {
                $db->prepare(
                    'INSERT INTO wp_player_music (steamid, weapon_team, music_id) VALUES (?, ?, ?)'
                )->execute([$steamid, $t, $musicId]);
            }
        }
        echo json_encode([
            'success' => true,
            'music_id' => $musicId > 0 ? $musicId : null,
            'teams' => $teams,
        ]);
        break;
    }

    case 'pin_save': {
        $pinId = intval($_POST['pin_id'] ?? 0);
        $both = isset($_POST['both_teams']) && in_array(
            strtolower((string) $_POST['both_teams']),
            ['1', 'true', 'yes', 'on'],
            true
        );
        $teams = $both ? [2, 3] : [$team];
        foreach ($teams as $t) {
            if ($pinId <= 0) {
                $db->prepare(
                    'DELETE FROM wp_player_pins WHERE steamid = ? AND weapon_team = ?'
                )->execute([$steamid, $t]);
                continue;
            }
            $exists = $db->prepare(
                'SELECT COUNT(*) FROM wp_player_pins WHERE steamid = ? AND weapon_team = ?'
            );
            $exists->execute([$steamid, $t]);
            if ($exists->fetchColumn() > 0) {
                $db->prepare(
                    'UPDATE wp_player_pins SET id = ? WHERE steamid = ? AND weapon_team = ?'
                )->execute([$pinId, $steamid, $t]);
            } else {
                $db->prepare(
                    'INSERT INTO wp_player_pins (steamid, weapon_team, id) VALUES (?, ?, ?)'
                )->execute([$steamid, $t, $pinId]);
            }
        }
        echo json_encode([
            'success' => true,
            'pin_id' => $pinId > 0 ? $pinId : null,
            'teams' => $teams,
        ]);
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

