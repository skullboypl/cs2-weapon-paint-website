<?php
require __DIR__.'/../backend/class/Database.php';
require __DIR__.'/../backend/class/CloudHubRounds.php';
$db=Database::getInstance()->getConnection();
if (!preg_match('/^cloudhub_test_[a-f0-9]+$/D',(string)$db->query('SELECT DATABASE()')->fetchColumn())) throw new RuntimeException('Disposable DB required');
echo (new CloudHubRounds($db))->accept('test',file_get_contents($argv[1]))['status'];
