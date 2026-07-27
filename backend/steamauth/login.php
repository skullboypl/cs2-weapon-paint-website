<?php
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../class/SessionBootstrap.php';

wp_boot_session();

if (isset($_SESSION['steamid'])) {
    header('Location: ' . rtrim(DOMAIN_NAME, '/') . '/?steamid=' . urlencode($_SESSION['steamid']));
    exit;
}

header('Location: ' . rtrim(API_DOMAIN_NAME, '/') . '/steamauth/steamlogin.php');
exit;
