<?php
require_once __DIR__ . '/../config.php'; 
require 'openid.php';           // Obsługa Steam OpenID

try {
    $openid = new LightOpenID($_SERVER['HTTP_HOST']);

    if (!$openid->mode) {
        $openid->identity = 'https://steamcommunity.com/openid';
        header('Location: ' . $openid->authUrl());
    } elseif ($openid->mode === 'cancel') {
        echo 'Użytkownik anulował logowanie.';
    } else {
        if ($openid->validate()) {
            $id = $openid->identity;
            $matches = [];
            preg_match("/^https?:\/\/steamcommunity.com\/openid\/id\/([0-9]{17,25})$/", $id, $matches);
            $steamid = $matches[1];

            session_start();
            $_SESSION['steamid'] = $steamid;

            // 🔁 Po zalogowaniu wróć do login.php
            header('Location: ' . STEAM_LOGIN_PAGE);
        } else {
            echo 'Błąd podczas weryfikacji OpenID';
        }
    }
} catch (Exception $e) {
    echo 'Wyjątek: ' . $e->getMessage();
}
