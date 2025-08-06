<?php
header("Access-Control-Allow-Origin: http://localhost:5173");
header("Access-Control-Allow-Credentials: true");
header("Content-Type: application/json");

session_start();
require_once __DIR__ . '/../config.php'; 
session_unset();
session_destroy();

header("Location: ".DOMAIN_NAME."/"); 
exit;
