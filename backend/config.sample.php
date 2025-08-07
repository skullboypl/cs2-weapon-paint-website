<?php
// Configuration file for the backend

// 🔑 Steam + Domain
define('STEAM_API_KEY', 'STEAMAPI KEY');         // Replace with your actual Steam API key
define('DOMAIN_NAME', 'https://YOURDOMAINNAME.com');     // Replace with your domain name

// 🛠️ MySQL credentials
define('DB_HOST', 'localhost');                  // Replace with your database host
define('DB_PORT', '3306');                       // Replace with your database port
define('DB_NAME', 'your_db');                    // Replace with your database name
define('DB_USER', 'your_db_user');               // Replace with your database username
define('DB_PASS', 'your_db_password');           // Replace with your database password

// 🔗 Derived constants (DO NOT TOUCH)
define('API_DOMAIN_NAME', DOMAIN_NAME . '/api'); // Replace with your API subdirectory if different
define('STEAM_DOMAIN_NAME', API_DOMAIN_NAME);    
define('STEAM_LOGOUT_PAGE', API_DOMAIN_NAME . '/steamauth/logout.php');
define('STEAM_LOGIN_PAGE', API_DOMAIN_NAME . '/steamauth/login.php');
