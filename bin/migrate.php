<?php
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
if (!in_array('--apply', $argv, true)) {
    fwrite(STDERR, "Usage: CLOUDHUB_CONFIG=/private/config.php php bin/migrate.php --apply\nBack up the selected database and verify its name first. Uses CREATE TABLE IF NOT EXISTS and additive migrations only.\n");
    exit(1);
}
define('DB_AUTO_MIGRATE', true);
$api = is_dir(__DIR__ . '/../backend') ? __DIR__ . '/../backend' : __DIR__ . '/../public/api';
require_once $api . '/class/Database.php';
Database::getInstance()->getConnection();
echo "CloudHub schema initialized.\n";
