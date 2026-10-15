<?php
require_once __DIR__ . '/bootstrap.php';
header('Content-Type: application/json');
echo json_encode(['status' => 'OK', 'application' => 'CloudHub CS2']);
