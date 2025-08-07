<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/class/Database.php';
session_start();

header("Access-Control-Allow-Origin: http://localhost:5173");
header("Access-Control-Allow-Credentials: true");
header("Content-Type: application/json");

if (!isset($_SESSION['steamid'])) {
    http_response_code(401);
    echo json_encode(['error' => 'Not logged in']);
    exit;
}

$steamid = $_SESSION['steamid'];
$action = $_POST['action'] ?? '';
$team = isset($_POST['team']) ? $_POST['team'] : '';
//if CT then 3 if T then 2
if($team =="CT"){
    $team = 3;
} elseif($team == "T"){
    $team = 2;
} else {
    $team = 0; // Invalid team
    http_response_code(400);
    echo json_encode(['error' => 'Invalid team']);
    exit;
}
$db = Database::getInstance()->getConnection();
if (!$db) {
    http_response_code(500);
    echo json_encode(['errorDB' => 'Database connection failed remember to set up data in config.php']);
    exit;
}


switch ($action) {
    case 'get':
        if ($team !== 2 && $team !== 3) {
            echo json_encode(['error' => 'Invalid team']);
            exit;
        }

        $stmt = $db->prepare("SELECT knife FROM wp_player_knife WHERE steamid = ? AND weapon_team = ?");
        $stmt->execute([$steamid, $team]);
        $knife = $stmt->fetchColumn();

        echo json_encode([
            'knife' => $knife ?: 'weapon_knife' // default jeśli brak
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
        $stmt = $db->prepare("SELECT COUNT(*) FROM wp_player_knife WHERE steamid = ? AND weapon_team = ?");
        $stmt->execute([$steamid, $team]);
        $exists = $stmt->fetchColumn() > 0;

        if ($exists) {
            $stmt = $db->prepare("UPDATE wp_player_knife SET knife = ? WHERE steamid = ? AND weapon_team = ?");
            $stmt->execute([$knife, $steamid, $team]);
        } else {
            $stmt = $db->prepare("INSERT INTO wp_player_knife (steamid, weapon_team, knife) VALUES (?, ?, ?)");
            $stmt->execute([$steamid, $team, $knife]);
        }

        echo json_encode(['success' => true]);
        break;

    default:
        echo json_encode(['error' => 'Invalid action']);
        break;
}
