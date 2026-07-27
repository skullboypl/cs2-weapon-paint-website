<?php
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../class/SessionBootstrap.php';

wp_send_cors_headers();
wp_boot_session();

$_SESSION = [];

if (ini_get('session.use_cookies')) {
    setcookie(session_name(), '', [
        'expires' => time() - 42000,
        'path' => '/',
        'secure' => wp_is_https(),
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
}

session_destroy();

header('Location: ' . rtrim(DOMAIN_NAME, '/') . '/');
exit;
