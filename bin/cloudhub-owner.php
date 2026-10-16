<?php
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
$options = getopt('', ['steamid:', 'confirm-steamid:', 'reason:']);
$id = $options['steamid'] ?? '';
if (!is_string($id) || $id === '' || ($options['confirm-steamid'] ?? null) !== $id || !is_string($options['reason'] ?? null)) {
    fwrite(STDERR, "Usage: CLOUDHUB_CONFIG=/private/config.php php bin/cloudhub-owner.php --steamid=STEAMID64 --confirm-steamid=STEAMID64 --reason='Initial owner assignment'\nRequires a previous verified Steam login. Never selects the first player automatically.\n");
    exit(1);
}
if (!defined('DB_AUTO_MIGRATE')) { define('DB_AUTO_MIGRATE', false); }
$api = is_dir(__DIR__ . '/../backend') ? __DIR__ . '/../backend' : __DIR__ . '/../public/api';
require_once $api . '/class/Database.php';
require_once $api . '/class/CloudHubAccounts.php';
try {
    (new CloudHubAccounts(Database::getInstance()->getConnection()))->bootstrapOwner($id, $options['reason']);
    echo "Initial OWNER assigned and audited. No RP or CC changed.\n";
} catch (Throwable $e) {
    fwrite(STDERR, $e instanceof PDOException ? "Database operation failed; inspect private server logs.\n" : $e->getMessage() . "\n");
    exit(1);
}
