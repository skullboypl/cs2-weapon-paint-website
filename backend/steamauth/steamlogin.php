<?php
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../class/SessionBootstrap.php';
require __DIR__ . '/openid.php';

wp_boot_session();

try {
    // Host z configu - NIE z HTTP_HOST (Vite changeOrigin → 127.0.0.1:8080 psuje return_to)
    $domainParts = parse_url(DOMAIN_NAME);
    $host = $domainParts['host'] ?? 'localhost';
    if (!empty($domainParts['port'])) {
        $host .= ':' . $domainParts['port'];
    }

    $openid = new LightOpenID($host);
    $openid->trustRoot = rtrim(DOMAIN_NAME, '/') . '/';
    $openid->returnUrl = rtrim(API_DOMAIN_NAME, '/') . '/steamauth/steamlogin.php';

    if (!$openid->mode) {
        $openid->identity = 'https://steamcommunity.com/openid';
        header('Location: ' . $openid->authUrl());
        exit;
    }

    if ($openid->mode === 'cancel') {
        header('Location: ' . rtrim(DOMAIN_NAME, '/') . '/?login=cancelled');
        exit;
    }

    if ($openid->validate()) {
        $id = $openid->identity;
        $matches = [];
        preg_match('#^https?://steamcommunity\.com/openid/id/([0-9]{17,25})$#', $id, $matches);
        $steamid = $matches[1] ?? null;

        if (!$steamid) {
            echo 'Nie udało się odczytać SteamID.';
            exit;
        }

        $_SESSION['steamid'] = $steamid;
        $_SESSION['login_at'] = time();

        // Persist Steam profile + login meta (best-effort; never block login)
        $sessionProfile = [
            'steamid' => $steamid,
            'personaname' => null,
            'avatar' => null,
            'profileurl' => null,
            'loccountrycode' => null,
        ];
        try {
            require_once __DIR__ . '/../class/UserData.php';
            $saved = UserData::upsertFromSteam($steamid, true);
            if (is_array($saved)) {
                $sessionProfile = [
                    'steamid' => $saved['steamid'] ?? $steamid,
                    'personaname' => $saved['personaname'] ?? null,
                    'avatar' => $saved['avatar'] ?? null,
                    'profileurl' => $saved['profileurl'] ?? null,
                    'loccountrycode' => $saved['loccountrycode'] ?? null,
                ];
            } else {
                $player = UserData::fetchSteamPlayer($steamid);
                if ($player) {
                    $sessionProfile = [
                        'steamid' => $player['steamid'] ?? $steamid,
                        'personaname' => $player['personaname'] ?? null,
                        'avatar' => $player['avatarfull'] ?? ($player['avatarmedium'] ?? ($player['avatar'] ?? null)),
                        'profileurl' => $player['profileurl'] ?? null,
                        'loccountrycode' => $player['loccountrycode'] ?? null,
                    ];
                }
            }
        } catch (Throwable $e) {
            // ignore - login still succeeds
        }

        $_SESSION['user_profile'] = $sessionProfile;
        $_SESSION['user_profile_at'] = time();

        // Odśwież cookie od razu po zalogowaniu
        wp_refresh_session_cookie();

        header('Location: ' . rtrim(DOMAIN_NAME, '/') . '/?steamid=' . urlencode($steamid));
        exit;
    }

    echo 'Błąd podczas weryfikacji OpenID';
} catch (Exception $e) {
    echo 'Wyjątek: ' . htmlspecialchars($e->getMessage(), ENT_QUOTES, 'UTF-8');
}
