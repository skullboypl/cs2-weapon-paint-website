<?php
/**
 * Wspólny bootstrap sesji PHP (Steam login).
 * Długa sesja (30 dni), sliding refresh, Secure tylko na HTTPS.
 * Pliki sesji w backend/storage/sessions - przeżywają restart PHP built-in server.
 */
function wp_request_is_https(): bool {
    if (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') {
        return true;
    }
    if (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && strtolower((string) $_SERVER['HTTP_X_FORWARDED_PROTO']) === 'https') {
        return true;
    }
    if (isset($_SERVER['HTTP_X_FORWARDED_SSL']) && $_SERVER['HTTP_X_FORWARDED_SSL'] === 'on') {
        return true;
    }
    if (isset($_SERVER['SERVER_PORT']) && (int) $_SERVER['SERVER_PORT'] === 443) {
        return true;
    }
    return false;
}

function wp_is_https(): bool {
    if (wp_request_is_https()) {
        return true;
    }
    // Cookie Secure when production DOMAIN_NAME is https (even if local probe differs).
    if (defined('DOMAIN_NAME') && str_starts_with(DOMAIN_NAME, 'https://')) {
        return true;
    }
    return false;
}

/** Truthy check for optional config defines (bool or "true"/"1"/"yes"/"on"). */
function wp_config_flag_enabled(string $name): bool {
    if (!defined($name)) {
        return false;
    }
    $v = constant($name);
    if (is_bool($v)) {
        return $v;
    }
    $s = strtolower(trim((string) $v));
    return in_array($s, ['1', 'true', 'yes', 'on'], true);
}

/**
 * Optional HTTP -> HTTPS redirect when SSL_REDIRECT is enabled in config.php.
 * Skips CLI. Honours X-Forwarded-Proto behind reverse proxies.
 */
function wp_maybe_ssl_redirect(): void {
    if (PHP_SAPI === 'cli' || PHP_SAPI === 'phpdbg') {
        return;
    }
    if (!wp_config_flag_enabled('SSL_REDIRECT')) {
        return;
    }
    if (wp_request_is_https()) {
        return;
    }
    $host = $_SERVER['HTTP_HOST'] ?? '';
    if ($host === '') {
        return;
    }
    $uri = $_SERVER['REQUEST_URI'] ?? '/';
    header('Location: https://' . $host . $uri, true, 301);
    exit;
}

function wp_session_lifetime(): int {
    return defined('SESSION_LIFETIME') ? (int) SESSION_LIFETIME : 60 * 60 * 24 * 30; // 30 dni
}

function wp_session_save_path(): string {
    $dir = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'storage' . DIRECTORY_SEPARATOR . 'sessions';
    if (!is_dir($dir)) {
        @mkdir($dir, 0775, true);
    }
    return $dir;
}

function wp_session_cookie_params_array(int $lifetime, bool $secure): array {
    return [
        'lifetime' => $lifetime,
        'path' => '/',
        'secure' => $secure,
        'httponly' => true,
        'samesite' => 'Lax',
    ];
}

/** Zawsze odśwież cookie (także pustą sesję) - wymienia martwe ID po GC / restarcie. */
function wp_refresh_session_cookie(): void {
    if (session_status() !== PHP_SESSION_ACTIVE) {
        return;
    }
    $lifetime = wp_session_lifetime();
    $secure = wp_is_https();
    setcookie(session_name(), session_id(), [
        'expires' => time() + $lifetime,
        'path' => '/',
        'secure' => $secure,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
}

function wp_boot_session(): void {
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    $lifetime = wp_session_lifetime();
    $secure = wp_is_https();
    $savePath = wp_session_save_path();

    // NIE wymuszaj Secure na lokalnym HTTP - inaczej przeglądarka odrzuca cookie.
    if (is_dir($savePath) && is_writable($savePath)) {
        session_save_path($savePath);
    }

    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    ini_set('session.cookie_httponly', '1');
    ini_set('session.gc_maxlifetime', (string) $lifetime);
    // Rzadsze GC - sesje 30-dniowe nie znikają co restart/dev
    ini_set('session.gc_probability', '1');
    ini_set('session.gc_divisor', '1000');

    session_set_cookie_params(wp_session_cookie_params_array($lifetime, $secure));
    session_name('wp_session');
    session_start();

    // Sliding expiration - zawsze odnawia cookie (utrzymuje login po restarcie PHP)
    wp_refresh_session_cookie();
}

/** CORS pod frontend (credentials). */
function wp_send_cors_headers(): void {
    $origin = defined('DOMAIN_NAME') ? rtrim(DOMAIN_NAME, '/') : '';
    $requestOrigin = $_SERVER['HTTP_ORIGIN'] ?? '';

    if ($origin !== '' && $requestOrigin === $origin) {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Access-Control-Allow-Credentials: true');
        header('Vary: Origin');
    }

    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type');
        http_response_code(204);
        exit;
    }
}

wp_maybe_ssl_redirect();
