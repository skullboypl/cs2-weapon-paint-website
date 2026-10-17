<?php
// Called only by the disposable DB harness, never shipped into public/.
require_once __DIR__ . '/../backend/class/CloudHubSchema.php';
require_once __DIR__ . '/../backend/class/CloudHubAccounts.php';
$db = Database::getInstance()->getConnection();
if (!preg_match('/^cloudhub_test_[a-f0-9]+$/D', (string)$db->query('SELECT DATABASE()')->fetchColumn())) { throw new RuntimeException('Disposable database required'); }
$checks = 0;
$check = function (bool $ok, string $message) use (&$checks): void {
    if (!$ok) { throw new RuntimeException($message); }
    $checks++;
};
$reject = function (callable $fn, string $message) use ($check): void {
    try { $fn(); } catch (InvalidArgumentException|RuntimeException|PDOException $e) { $check(true,$message); return; }
    $check(false,$message);
};
$db->exec("INSERT INTO wp_player_skins(steamid,weapon_team,weapon_defindex,weapon_paint_id,weapon_seed,weapon_nametag,weapon_stattrak_count) VALUES ('76561198000000099',2,7,282,321,'Preserve me',42)");
$skinBefore = $db->query("SELECT * FROM wp_player_skins WHERE steamid='76561198000000099'")->fetch(PDO::FETCH_ASSOC);
$wpBefore = [];
foreach ($db->query("SHOW TABLES LIKE 'wp_%'")->fetchAll(PDO::FETCH_COLUMN) as $table) {
    $wpBefore[$table] = $db->query("SHOW CREATE TABLE `$table`")->fetch(PDO::FETCH_NUM)[1];
}
CloudHubSchema::migrate($db, __DIR__ . '/../migrations');
CloudHubSchema::migrate($db, __DIR__ . '/../migrations');
$check((int)$db->query('SELECT COUNT(*) FROM cloudhub_schema_migrations')->fetchColumn() === 2,'Repeat migration must be idempotent');
foreach ($wpBefore as $table => $schema) { $check($schema === $db->query("SHOW CREATE TABLE `$table`")->fetch(PDO::FETCH_NUM)[1], 'WeaponPaints schema unchanged'); }
$check($skinBefore === $db->query("SELECT * FROM wp_player_skins WHERE steamid='76561198000000099'")->fetch(PDO::FETCH_ASSOC),'Existing skin settings survive migration');
$db->exec("DELETE FROM wp_player_skins WHERE steamid='76561198000000099'");
$check((int)$db->query('SELECT COUNT(*) FROM cloudhub_seasons')->fetchColumn() === 0, 'No automatic season');
$check((int)$db->query('SELECT COUNT(*) FROM cloudhub_rank_config')->fetchColumn() === 6,'Initial ranks');
$db->exec("UPDATE cloudhub_rank_config SET min_rp=501 WHERE rank_key='silver'");
CloudHubSchema::migrate($db, __DIR__ . '/../migrations');
$check((int)$db->query("SELECT min_rp FROM cloudhub_rank_config WHERE rank_key='silver'")->fetchColumn() === 501,'Migration must preserve edited settings');
$db->exec("UPDATE cloudhub_rank_config SET min_rp=500 WHERE rank_key='silver'");
$db->exec("UPDATE cloudhub_schema_migrations SET sha256=REPEAT('0',64) WHERE version='001_cloudhub_foundations.sql'");
$reject(fn()=>CloudHubSchema::migrate($db,__DIR__.'/../migrations'),'Reject changed migration checksum');
$db->prepare("UPDATE cloudhub_schema_migrations SET sha256=? WHERE version='001_cloudhub_foundations.sql'")->execute([hash_file('sha256',__DIR__.'/../migrations/001_cloudhub_foundations.sql')]);
$a = new CloudHubAccounts($db);
$one = '76561198000000001'; $two = '76561198000000002';
$reject(fn()=>$a->register('76561198000000001 OR 1=1','Bad'),'Reject noncanonical identity');
$a->register($one,'Original',null,true);
$a->register($two,'Other Player');
$check($a->roles($one) === ['PLAYER'],'First login must not grant owner');
$check(!$a->can($one,'wallet.adjust'),'Player cannot adjust currency');
$reject(fn()=>$a->bootstrapOwner($two,'Owner'),'Require verified Steam login');
$db->exec("UPDATE cloudhub_wallets SET balance=123 WHERE steamid='$one'");
$db->exec("UPDATE cloudhub_player_stats SET rp=1200 WHERE steamid='$one'");
$a->register($one,'Cloud Player');
$account = $a->account($one);
$check($account['balance'] === '123' && $account['rp'] === '1200','Repeated registration preserves RP/CC');
$check($account['nickname'] === 'Cloud Player' && $account['steamid'] === $one,'Nickname changes preserve identity');
$check($account['rank']['rank_key'] === 'gold' && $account['next_rank']['rank_key'] === 'platinum','Rank boundary and next rank');
$check((int)$db->query('SELECT COUNT(*) FROM cloudhub_wallets')->fetchColumn() === 2,'One wallet per account');
$reject(fn()=>$db->exec("UPDATE cloudhub_wallets SET balance=-1 WHERE steamid='$one'"),'Reject negative balances');
$reject(fn()=>$db->exec("INSERT INTO cloudhub_wallet_transactions(operation_key,steamid,amount,balance_before,balance_after,source,reason) VALUES ('bad','$one',10,0,9,'test','test')"),'Reject inconsistent transaction arithmetic');
$check((int)$db->query('SELECT COUNT(*) FROM cloudhub_wallet_transactions')->fetchColumn() === 0,'Registration never mints coins');
$a->bootstrapOwner($one,'Explicit isolated test assignment');
$check($a->can($one,'roles.manage'),'Explicit OWNER gets permissions');
$check((int)$db->query("SELECT COUNT(*) FROM cloudhub_admin_audit_logs WHERE action='owner.bootstrap'")->fetchColumn() === 1,'Owner assignment audited');
$reject(fn()=>$a->bootstrapOwner($one,'Repeat'),'Owner bootstrap closes after first assignment');
$db->exec("INSERT INTO cloudhub_player_roles VALUES ('$two','MODERATOR',UTC_TIMESTAMP(6))");
$check($a->can($two,'moderation.manage'),'Moderator can moderate');
$check(!$a->can($two,'wallet.adjust') && !$a->can($two,'roles.manage'),'Moderator cannot manage currency or roles');
$db->exec("DELETE FROM cloudhub_player_roles WHERE steamid='$two' AND role='MODERATOR'");
$check(!$a->can($two,'moderation.manage'),'Role revocation takes effect immediately');
$db->exec("UPDATE cloudhub_player_stats SET rp=0 WHERE steamid='$one'");
$db->exec("UPDATE cloudhub_wallets SET balance=0 WHERE steamid='$one'");
fwrite(STDERR, "CloudHub foundation assertions passed: $checks\n");
