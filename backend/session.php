<?php
require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/class/SessionBootstrap.php';
require_once __DIR__ . '/class/ApiProtect.php';
wp_send_cors_headers();
wp_boot_session();
wp_enforce_rate_limit($_SESSION['steamid'] ?? null);
header('Content-Type: application/json');
echo json_encode(['csrf_token' => wp_csrf_token()]);
