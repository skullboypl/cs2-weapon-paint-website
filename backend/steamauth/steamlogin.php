<?php
require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../class/SessionBootstrap.php';
require_once __DIR__ . '/../class/ApiProtect.php';
require_once __DIR__ . '/../class/SteamOpenID.php';
wp_boot_session();
wp_enforce_rate_limit();
$callback = rtrim(API_DOMAIN_NAME, '/') . '/steamauth/steamlogin.php';
$mode = $_GET['openid_mode'] ?? null;
if ($mode === null) {
    $state = bin2hex(random_bytes(32));
    $_SESSION['steam_login'] = ['state' => $state, 'created' => time()];
    header('Location: ' . SteamOpenID::loginUrl($callback . '?state=' . $state, rtrim(DOMAIN_NAME, '/') . '/'));
    exit;
}
$pending = $_SESSION['steam_login'] ?? null;
unset($_SESSION['steam_login']); // One attempt per challenge; prevents replay.
$state = $_GET['state'] ?? '';
$steamid = null;
if (is_array($pending) && is_string($state) && time() - $pending['created'] <= 600 && hash_equals($pending['state'], $state)) {
    $steamid = SteamOpenID::verify($_GET, $callback . '?state=' . $state);
}
if (!$steamid) {
    header('Location: ' . rtrim(DOMAIN_NAME, '/') . '/?login=failed');
    exit;
}
session_regenerate_id(true);
$_SESSION = ['steamid' => $steamid, 'login_at' => time(), 'csrf_token' => bin2hex(random_bytes(32))];
$profile = null;
try {
    require_once __DIR__ . '/../class/UserData.php';
    $profile = UserData::upsertFromSteam($steamid, true);
} catch (Throwable $e) {
    error_log('CloudHub Steam profile refresh failed');
}
$_SESSION['user_profile'] = [
    'steamid' => $steamid,
    'personaname' => $profile['personaname'] ?? 'Player',
    'avatar' => $profile['avatarfull'] ?? $profile['avatar'] ?? null,
    'profileurl' => 'https://steamcommunity.com/profiles/' . $steamid,
];
$_SESSION['user_profile_at'] = time();
wp_refresh_session_cookie();
header('Location: ' . rtrim(DOMAIN_NAME, '/') . '/');
