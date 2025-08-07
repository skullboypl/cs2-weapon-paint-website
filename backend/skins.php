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
$team = $_POST['team'] ?? '';
$action = $_POST['action'] ?? '';

if ($team === 'CT') $team = 3;
elseif ($team === 'T') $team = 2;
 else {
    $team = 0; // Invalid team
    http_response_code(400);
    echo json_encode(['error' => 'Invalid team']);
    exit;
}

$db = Database::getInstance()->getConnection();
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
            weapon_keychain FROM wp_player_skins WHERE steamid = ? AND weapon_team = ?");
        $stmt->execute([$steamid, $team]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode($rows);
        break;
        case 'save':
            $weapon_defindex = $_POST['weapon_defindex'] ?? '';
            $paint = $_POST['paint'] ?? 0;
            $wear = $_POST['wear'] ?? 0;
            $seed = $_POST['seed'] ?? 0;
            $nametag = $_POST['nametag'] ?? null;
            $stattrak = $_POST['stattrak'] ?? 0;
            $stattrakcount = $_POST['stattrak_count'] ?? 0;
            $stickers = [
                intval($_POST['weapon_sticker_0'] ?? 0),
                intval($_POST['weapon_sticker_1'] ?? 0),
                intval($_POST['weapon_sticker_2'] ?? 0),
                intval($_POST['weapon_sticker_3'] ?? 0),
             ];
            $keychainId = $_POST['keychainId'] ?? 0;
            $offsetX = $_POST['offsetX'] ?? 0;
            $offsetY = $_POST['offsetY'] ?? 0;

            // STICKER FORMAT: id;0;0;0;0.5;0 (schema;x;y;wear;scale;rotation)
            // Scale 0.5 is default, rotation 0 is default
            // Ensure stickers are an array of 4 elements
            $stickerFields = [];
            for ($i = 0; $i < 4; $i++) {
                $id = isset($stickers[$i]) ? intval($stickers[$i]) : 0;
                if($id > 0) {
                    $stickerFields[] = "$id;0;0;0;0;1;0"; // Default scale 0.5 and rotation 0
                } else {
                    $stickerFields[] = "0;0;0;0;0;0;0"; // No sticker
                }
            }

            // KEYCHAIN FORMAT: id;x;y;0;0
            $keychainField = "$keychainId;$offsetX;$offsetY;0;0";

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
                    weapon_sticker_0, weapon_sticker_1, weapon_sticker_2, weapon_sticker_3,
                    weapon_keychain
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
                $stmt->execute([
                    $steamid, $team, $weapon_defindex,
                    $paint, $wear, $seed,
                    $nametag, is_null($stattrak) ? 0 : 1, $stattrak ?? 0,
                    $stickerFields[0], $stickerFields[1], $stickerFields[2], $stickerFields[3],
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
            echo json_encode(['error' => 'No agent found']);
        }
        break;
    case 'gloves_addon_data':
        // 1. Pobierz modele rękawic dla gracza
        $stmt = $db->prepare("SELECT weapon_team, weapon_defindex FROM wp_player_gloves WHERE steamid = ?");
        $stmt->execute([$steamid]);
        $gloves_models = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $gloves_skins = [];

        $sql = "SELECT weapon_team, weapon_defindex, weapon_paint_id, weapon_wear, weapon_seed 
                FROM wp_player_skins 
                WHERE steamid = ? AND weapon_defindex = ? AND weapon_team = ?";

        $stmt = $db->prepare($sql);

        foreach ($gloves_models as $model) {
            $stmt->execute([$steamid, $model['weapon_defindex'], $model['weapon_team']]);
            $result = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($result) {
                $gloves_skins[] = $result;
            }
        }

        // 4. Wyślij połączone dane
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
    default:
        http_response_code(400);
        echo json_encode(['error' => 'Invalid action']);
        exit;
}

