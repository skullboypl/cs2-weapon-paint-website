<?php
session_start();
require_once __DIR__ . '/config.php'; 


if (isset($_SESSION['steamid'])) {
    $steamid = $_SESSION['steamid'];
    header("Location: " . DOMAIN_NAME . "/?steamid=$steamid");
    exit;
}

// Jeśli nie ma sesji, przekieruj do steamlogin.php
header("Location: " . API_DOMAIN_NAME . "/steamauth/steamlogin.php");
exit;
