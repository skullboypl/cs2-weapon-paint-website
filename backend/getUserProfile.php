<?php
ini_set('session.cookie_secure', '1');
ini_set('session.cookie_samesite', 'None');
session_start();
require_once __DIR__ . '/config.php';

header('Content-Type: application/json');

if (!isset($_SESSION['steamid'])) {
    echo json_encode(['error' => 'Not logged in']);
    exit;
}

$steamid = $_SESSION['steamid'];
$apiKey = STEAM_API_KEY;

$url = "https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=$apiKey&steamids=$steamid";
$response = file_get_contents($url);
$data = json_decode($response, true);

if (!isset($data['response']['players'][0])) {
    echo json_encode(['error' => 'User data not found']);
    exit;
}

$player = $data['response']['players'][0];

// Możesz zwrócić tylko potrzebne pola:
echo json_encode([
    'steamid' => $player['steamid'],
    'personaname' => $player['personaname'],
    'avatar' => $player['avatarfull'],
    'profileurl' => $player['profileurl']
]); 