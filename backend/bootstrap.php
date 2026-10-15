<?php
// Production configuration may live outside the public document root.
$config = getenv('CLOUDHUB_CONFIG') ?: __DIR__ . '/config.php';
if (is_file($config)) {
    require_once $config;
} else {
    require_once __DIR__ . '/config.sample.php';
}
require_once __DIR__ . '/class/Security.php';
if (PHP_SAPI !== 'cli') {
    header('X-Content-Type-Options: nosniff');
    header('Referrer-Policy: strict-origin-when-cross-origin');
    header('Cache-Control: no-store');
    ini_set('display_errors', '0');
    set_exception_handler(function (Throwable $e): void {
        while (ob_get_level() > 0) { ob_end_clean(); }
        error_log('CloudHub request failed: ' . get_class($e));
        wp_json_error(500, 'The request could not be completed. Please try again.');
    });
}
