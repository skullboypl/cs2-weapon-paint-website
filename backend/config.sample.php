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

// ⏱ Session cookie lifetime (30 days, sliding). Cookie: wp_session (HttpOnly).
// Session files live in backend/storage/sessions so PHP built-in server restarts
// do not log you out. Clear only on explicit logout or cookie expiry.
define('SESSION_LIFETIME', 60 * 60 * 24 * 30);

// 🔗 Derived constants (DO NOT TOUCH)
define('API_DOMAIN_NAME', DOMAIN_NAME . '/api'); // Replace with your API subdirectory if different
define('STEAM_DOMAIN_NAME', API_DOMAIN_NAME);
define('STEAM_LOGOUT_PAGE', API_DOMAIN_NAME . '/steamauth/logout.php');
define('STEAM_LOGIN_PAGE', API_DOMAIN_NAME . '/steamauth/login.php');

// Optional: unlock beta 3D weapon preview in the UI.
// Without this define (or with false) the 3D toggle stays hidden.
// define('BETA_3D', true);

// Optional: redirect HTTP to HTTPS (301). Useful for production behind TLS.
// Honours X-Forwarded-Proto / X-Forwarded-SSL. Keep off for local HTTP/Vite.
// define('SSL_REDIRECT', true);

// Anti-abuse: max API requests per IP+session within WINDOW seconds.
// Defaults: 120 / 60. Set API_RATE_LIMIT to 0 to disable.
// define('API_RATE_LIMIT', 120);
// define('API_RATE_WINDOW', 60);

// Short server cache for read actions (bootstrap / list / knife get).
// Skips MySQL when revision unchanged. Busted automatically on save/reset.
// Defaults to 5 seconds. Set to 0 to disable.
// define('API_READ_CACHE_TTL', 5);
