<?php
// Local-only test harness, never copied into the public release.
$socket = getenv('CLOUDHUB_TEST_SOCKET');
$name = getenv('CLOUDHUB_TEST_DATABASE');
if (!$socket || !str_starts_with($socket, '/') || !preg_match('/^cloudhub_test_[a-f0-9]+$/D', $name ?: '')) { throw new RuntimeException('Explicit local test socket and disposable database required'); }
$pdo = new PDO('mysql:unix_socket=' . $socket, getenv('CLOUDHUB_TEST_DB_USER') ?: get_current_user(), '', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
if (($argv[1] ?? '') === 'drop') { $pdo->exec("DROP DATABASE IF EXISTS `$name`"); exit; }
$pdo->exec("CREATE DATABASE `$name` CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci");
require_once __DIR__ . '/../backend/class/Database.php';
Database::getInstance()->getConnection();
require __DIR__ . "/foundations.php";
require __DIR__ . "/rounds.php";
require_once __DIR__ . '/../backend/class/SessionBootstrap.php';
foreach (['76561198000000001','76561198000000002'] as $index => $steamid) {
    session_save_path(wp_session_save_path());
    session_name('wp_session');
    session_id('cloudhubtest' . bin2hex(random_bytes(16)));
    session_start();
    $_SESSION = ['steamid' => $steamid, 'csrf_token' => bin2hex(random_bytes(32)), 'user_profile' => ['steamid' => $steamid, 'personaname' => $index === 0 ? 'Cloud Player' : 'Other Player', 'avatar' => '/images/cloudhub/avatar.svg'], 'user_profile_at' => time()];
    $sessions[] = ['id' => session_id(), 'steamid' => $steamid];
    session_write_close();
}
echo json_encode($sessions);
