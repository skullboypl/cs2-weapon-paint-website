<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/class/SessionBootstrap.php';
require_once __DIR__ . '/class/UserData.php';

wp_send_cors_headers();
wp_boot_session();

header('Content-Type: application/json');

if (!isset($_SESSION['steamid'])) {
    echo json_encode(['error' => 'Not logged in']);
    exit;
}

$steamid = (string) $_SESSION['steamid'];

// Fast path: profile stored in session at login (survives slow/remote DB)
$sessionProfile = $_SESSION['user_profile'] ?? null;
if (is_array($sessionProfile) && !empty($sessionProfile['steamid'])) {
    // Refresh from DB/Steam in background only if cache is stale (>1h) - best effort, never block login UI
    $cachedAt = (int) ($_SESSION['user_profile_at'] ?? 0);
    if ($cachedAt > 0 && (time() - $cachedAt) < 3600) {
        echo json_encode([
            'steamid' => $sessionProfile['steamid'] ?? $steamid,
            'personaname' => $sessionProfile['personaname'] ?? null,
            'avatar' => $sessionProfile['avatar'] ?? null,
            'profileurl' => $sessionProfile['profileurl'] ?? null,
            'loccountrycode' => $sessionProfile['loccountrycode'] ?? null,
            'realname' => $sessionProfile['realname'] ?? null,
        ]);
        exit;
    }
}

$profile = null;
try {
    $profile = UserData::getOrRefresh($steamid, 3600);
} catch (Throwable $e) {
    $profile = null;
}

if (!$profile) {
    try {
        $player = UserData::fetchSteamPlayer($steamid);
        if ($player) {
            $profile = [
                'steamid' => $player['steamid'] ?? $steamid,
                'personaname' => $player['personaname'] ?? null,
                'avatar' => $player['avatarfull'] ?? ($player['avatarmedium'] ?? ($player['avatar'] ?? null)),
                'profileurl' => $player['profileurl'] ?? null,
                'loccountrycode' => $player['loccountrycode'] ?? null,
                'realname' => $player['realname'] ?? null,
            ];
        }
    } catch (Throwable $e) {
        $profile = null;
    }
}

// Fallback to session snapshot so remote DB timeout never "logs you out"
if (!$profile && is_array($sessionProfile)) {
    $profile = $sessionProfile;
}

if (!$profile) {
    // Still logged in - return minimal identity from session
    echo json_encode([
        'steamid' => $steamid,
        'personaname' => null,
        'avatar' => null,
        'profileurl' => null,
        'loccountrycode' => null,
        'realname' => null,
    ]);
    exit;
}

$payload = [
    'steamid' => $profile['steamid'] ?? $steamid,
    'personaname' => $profile['personaname'] ?? null,
    'avatar' => $profile['avatar'] ?? null,
    'profileurl' => $profile['profileurl'] ?? null,
    'loccountrycode' => $profile['loccountrycode'] ?? null,
    'realname' => $profile['realname'] ?? null,
];

$_SESSION['user_profile'] = $payload;
$_SESSION['user_profile_at'] = time();

echo json_encode($payload);
