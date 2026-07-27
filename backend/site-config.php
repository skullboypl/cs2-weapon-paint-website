<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/class/SessionBootstrap.php';
require_once __DIR__ . '/class/ApiProtect.php';

wp_send_cors_headers();
wp_enforce_rate_limit(null);

header('Content-Type: application/json');
header('Cache-Control: no-store');

/**
 * BETA_3D must be explicitly true (bool or "true"/"1"/"yes"/"on").
 * Missing define => 3D preview hidden.
 */
function wp_is_beta_3d(): bool
{
    if (!defined('BETA_3D')) {
        return false;
    }
    $v = BETA_3D;
    if (is_bool($v)) {
        return $v;
    }
    $s = strtolower(trim((string) $v));
    return in_array($s, ['1', 'true', 'yes', 'on'], true);
}

echo json_encode([
    'beta_3d' => wp_is_beta_3d(),
    'cache_version' => wp_cache_build_id(),
]);
