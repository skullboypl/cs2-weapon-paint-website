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

$action = $_POST['action'] ?? '';
$team = isset($_POST['team']) ? $_POST['team'] : '';
//if CT then 3 if T then 2
if ($team == 'CT') {
    $team = 3;
} elseif ($team == 'T') {
    $team = 2;
} else {
    $team = 0; // Invalid team
    http_response_code(400);
    echo json_encode(['error' => 'Invalid team']);
    exit;
}

if ($action === 'set') {
    wp_api_bust($steamid);
}

$caching = false;
if ($action === 'get') {
    $cacheKey = 'knife_get|t=' . $team;
    if (wp_api_try_send_cache($steamid, $cacheKey)) {
        exit;
    }
    ob_start();
    $caching = true;
    $GLOBALS['__wp_api_cache_key'] = $cacheKey;
    $GLOBALS['__wp_api_cache_steamid'] = $steamid;
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
    case 'get':
        if ($team !== 2 && $team !== 3) {
            if ($caching && ob_get_level() > 0) {
                ob_end_clean();
            }
            echo json_encode(['error' => 'Invalid team']);
            exit;
        }

        $stmt = $db->prepare('SELECT knife FROM wp_player_knife WHERE steamid = ? AND weapon_team = ?');
        $stmt->execute([$steamid, $team]);
        $knife = $stmt->fetchColumn();

        echo json_encode([
            'knife' => $knife ?: 'weapon_knife', // default jeśli brak
        ]);
        break;

    case 'set':
        $knife = $_POST['knife'] ?? '';
        //check if begins with weapon_ if not add it
        if (!preg_match('/^weapon_/', $knife)) {
            $knife = 'weapon_' . $knife;
        }

        if ($team !== 2 && $team !== 3) {
            echo json_encode(['error' => 'Invalid team']);
            exit;
        }

        // Czy rekord istnieje?
        $stmt = $db->prepare('SELECT COUNT(*) FROM wp_player_knife WHERE steamid = ? AND weapon_team = ?');
        $stmt->execute([$steamid, $team]);
        $exists = $stmt->fetchColumn() > 0;

        if ($exists) {
            $stmt = $db->prepare('UPDATE wp_player_knife SET knife = ? WHERE steamid = ? AND weapon_team = ?');
            $stmt->execute([$knife, $steamid, $team]);
        } else {
            $stmt = $db->prepare('INSERT INTO wp_player_knife (steamid, weapon_team, knife) VALUES (?, ?, ?)');
            $stmt->execute([$steamid, $team, $knife]);
        }

        // Read back so client can confirm
        $stmt = $db->prepare('SELECT knife FROM wp_player_knife WHERE steamid = ? AND weapon_team = ?');
        $stmt->execute([$steamid, $team]);
        $stored = $stmt->fetchColumn();

        echo json_encode([
            'success' => true,
            'knife' => $stored ?: $knife,
        ]);
        break;

    default:
        if ($caching && ob_get_level() > 0) {
            ob_end_clean();
        }
        echo json_encode(['error' => 'Invalid action']);
        break;
}

if ($caching) {
    wp_api_end_read_cache();
}
