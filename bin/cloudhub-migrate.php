<?php
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
if (!in_array('--apply', $argv, true)) {
    fwrite(STDERR, "Usage: CLOUDHUB_CONFIG=/private/config.php php bin/cloudhub-migrate.php --apply\nBack up and verify the selected database first. Only cloudhub_* tables are created.\n");
    exit(1);
}
// Explicitly prevent the existing WeaponPaints auto-migrator from running.
if (!defined('DB_AUTO_MIGRATE')) { define('DB_AUTO_MIGRATE', false); }
$api = is_dir(__DIR__ . '/../backend') ? __DIR__ . '/../backend' : __DIR__ . '/../public/api';
require_once $api . '/class/Database.php';
require_once $api . '/class/CloudHubSchema.php';
CloudHubSchema::migrate(Database::getInstance()->getConnection(), __DIR__ . '/../migrations');
echo "CloudHub foundation migrations complete. WeaponPaints tables unchanged.\n";
