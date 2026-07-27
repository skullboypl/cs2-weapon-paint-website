<?php

require_once __DIR__ . '/../config.php';

class Database {
    private static $instance = null;
    private $pdo;
    private static bool $schemaReady = false;
    private static ?string $lastError = null;

    public function __construct() {
        if (!extension_loaded('pdo_mysql')) {
            throw new PDOException(
                'PHP extension pdo_mysql is missing. Enable extension=pdo_mysql in php.ini and restart PHP.'
            );
        }

        $attempts = 2;
        $last = null;

        for ($i = 1; $i <= $attempts; $i++) {
            try {
                // Remote hosts (e.g. lh.pl) are often slow; 3s caused false 503s under load.
                $connectTimeout = 12;
                $pdoOpts = [
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                ];
                if (defined('PDO::MYSQL_ATTR_CONNECT_TIMEOUT')) {
                    $pdoOpts[PDO::MYSQL_ATTR_CONNECT_TIMEOUT] = $connectTimeout;
                }
                $this->pdo = new PDO(
                    'mysql:host=' . DB_HOST . ';port=' . DB_PORT . ';dbname=' . DB_NAME . ';charset=utf8mb4',
                    DB_USER,
                    DB_PASS,
                    $pdoOpts
                );
                $this->pdo->setAttribute(PDO::ATTR_EMULATE_PREPARES, false);
                try {
                    $this->pdo->exec('SET SESSION wait_timeout=60');
                } catch (PDOException $ignored) {
                    // Some shared hosts disallow SESSION wait_timeout
                }
                $this->ensureSchema();
                self::$lastError = null;
                return;
            } catch (PDOException $e) {
                $last = $e;
                self::$lastError = $e->getMessage();
                if ($i < $attempts) {
                    usleep(350000);
                }
            }
        }

        throw $last ?? new PDOException('Database connection failed');
    }

    public static function getLastError(): ?string {
        return self::$lastError;
    }

    /**
     * @return Database
     * @throws PDOException
     */
    public static function getInstance() {
        if (self::$instance === null) {
            self::$instance = new Database();
        }
        return self::$instance;
    }

    /** Reset singleton (np. po chwilowym timeoutcie przy kolejnym requeście). */
    public static function reset(): void {
        self::$instance = null;
        self::$schemaReady = false;
    }

    public function getConnection() {
        return $this->pdo;
    }

    /**
     * Tworzy tabele jak Nereziel Utility.CheckDatabaseTables.
     * Plugin NIE seeduje skinów gracza - puste tabele są poprawnym stanem startowym.
     * Domyślne bronie biorą się z JSON (weapons.json / skins_en.json).
     */
    private function ensureSchema(): void {
        if (self::$schemaReady) {
            return;
        }

        $queries = [
            <<<'SQL'
CREATE TABLE IF NOT EXISTS `wp_player_skins` (
  `steamid` varchar(18) NOT NULL,
  `weapon_team` int(1) NOT NULL,
  `weapon_defindex` int(6) NOT NULL,
  `weapon_paint_id` int(6) NOT NULL,
  `weapon_wear` float NOT NULL DEFAULT 0.000001,
  `weapon_seed` int(16) NOT NULL DEFAULT 0,
  `weapon_nametag` VARCHAR(128) DEFAULT NULL,
  `weapon_stattrak` tinyint(1) NOT NULL DEFAULT 0,
  `weapon_stattrak_count` int(10) NOT NULL DEFAULT 0,
  `weapon_sticker_0` VARCHAR(128) NOT NULL DEFAULT '0;0;0;0;0;0;0' COMMENT 'id;schema;x;y;wear;scale;rotation',
  `weapon_sticker_1` VARCHAR(128) NOT NULL DEFAULT '0;0;0;0;0;0;0' COMMENT 'id;schema;x;y;wear;scale;rotation',
  `weapon_sticker_2` VARCHAR(128) NOT NULL DEFAULT '0;0;0;0;0;0;0' COMMENT 'id;schema;x;y;wear;scale;rotation',
  `weapon_sticker_3` VARCHAR(128) NOT NULL DEFAULT '0;0;0;0;0;0;0' COMMENT 'id;schema;x;y;wear;scale;rotation',
  `weapon_sticker_4` VARCHAR(128) NOT NULL DEFAULT '0;0;0;0;0;0;0' COMMENT 'id;schema;x;y;wear;scale;rotation',
  `weapon_keychain` VARCHAR(128) NOT NULL DEFAULT '0;0;0;0;0' COMMENT 'id;x;y;z;seed',
  UNIQUE (`steamid`, `weapon_team`, `weapon_defindex`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
SQL,
            <<<'SQL'
CREATE TABLE IF NOT EXISTS `wp_player_knife` (
  `steamid` varchar(18) NOT NULL,
  `weapon_team` int(1) NOT NULL,
  `knife` varchar(64) NOT NULL,
  UNIQUE (`steamid`, `weapon_team`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
SQL,
            <<<'SQL'
CREATE TABLE IF NOT EXISTS `wp_player_gloves` (
  `steamid` varchar(18) NOT NULL,
  `weapon_team` int(1) NOT NULL,
  `weapon_defindex` int(11) NOT NULL,
  UNIQUE (`steamid`, `weapon_team`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
SQL,
            <<<'SQL'
CREATE TABLE IF NOT EXISTS `wp_player_agents` (
  `steamid` varchar(18) NOT NULL,
  `agent_ct` varchar(64) DEFAULT NULL,
  `agent_t` varchar(64) DEFAULT NULL,
  UNIQUE (`steamid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
SQL,
            <<<'SQL'
CREATE TABLE IF NOT EXISTS `wp_player_music` (
  `steamid` varchar(64) NOT NULL,
  `weapon_team` int(1) NOT NULL,
  `music_id` int(11) NOT NULL,
  UNIQUE (`steamid`, `weapon_team`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
SQL,
            <<<'SQL'
CREATE TABLE IF NOT EXISTS `wp_player_pins` (
  `steamid` varchar(64) NOT NULL,
  `weapon_team` int(1) NOT NULL,
  `id` int(11) NOT NULL,
  UNIQUE (`steamid`, `weapon_team`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
SQL,
            <<<'SQL'
CREATE TABLE IF NOT EXISTS `wp_users_data` (
  `steamid` varchar(18) NOT NULL,
  `personaname` varchar(128) DEFAULT NULL,
  `profileurl` varchar(255) DEFAULT NULL,
  `avatar` varchar(255) DEFAULT NULL,
  `avatarmedium` varchar(255) DEFAULT NULL,
  `avatarfull` varchar(255) DEFAULT NULL,
  `realname` varchar(128) DEFAULT NULL,
  `loccountrycode` varchar(8) DEFAULT NULL,
  `locstatecode` varchar(16) DEFAULT NULL,
  `loccityid` int DEFAULT NULL,
  `persona_state` tinyint DEFAULT NULL,
  `communityvisibilitystate` tinyint DEFAULT NULL,
  `profilestate` tinyint DEFAULT NULL,
  `timecreated` int unsigned DEFAULT NULL,
  `lastlogoff` int unsigned DEFAULT NULL,
  `primaryclanid` varchar(32) DEFAULT NULL,
  `gameextrainfo` varchar(128) DEFAULT NULL,
  `gameid` varchar(32) DEFAULT NULL,
  `first_login_at` datetime DEFAULT NULL,
  `last_login_at` datetime DEFAULT NULL,
  `login_count` int unsigned NOT NULL DEFAULT 0,
  `last_ip` varchar(45) DEFAULT NULL,
  `last_user_agent` varchar(512) DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`steamid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
SQL,
            <<<'SQL'
CREATE TABLE IF NOT EXISTS `wp_saved_loadouts` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `steamid` varchar(18) NOT NULL,
  `name` varchar(48) NOT NULL,
  `scope` varchar(8) NOT NULL COMMENT 'team|both',
  `weapon_team` tinyint DEFAULT NULL COMMENT '2=T 3=CT, NULL when both',
  `is_public` tinyint(1) NOT NULL DEFAULT 0,
  `thumb_url` varchar(512) NOT NULL,
  `thumb_defindex` int DEFAULT NULL,
  `thumb_paint_id` int DEFAULT NULL,
  `payload` json NOT NULL,
  `created_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_steamid_name` (`steamid`, `name`),
  KEY `idx_steamid_scope` (`steamid`, `scope`, `weapon_team`),
  KEY `idx_public_updated` (`is_public`, `updated_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
SQL,
        ];

        try {
            foreach ($queries as $sql) {
                $this->pdo->exec($sql);
            }
            $this->migrateSchema();
            self::$schemaReady = true;
        } catch (PDOException $e) {
            throw new PDOException(
                '[WeaponPaints] Unable to create tables: ' . $e->getMessage(),
                (int) $e->getCode(),
                $e
            );
        }
    }

    /** Additive migrations for existing installs (CREATE IF NOT EXISTS won't alter). */
    private function migrateSchema(): void {
        $this->ensureColumn(
            'wp_saved_loadouts',
            'is_public',
            'ADD COLUMN `is_public` tinyint(1) NOT NULL DEFAULT 0 AFTER `weapon_team`',
        );
        $this->ensureIndex(
            'wp_saved_loadouts',
            'idx_public_updated',
            'ADD KEY `idx_public_updated` (`is_public`, `updated_at`)',
        );
    }

    private function ensureColumn(string $table, string $column, string $addSql): void {
        $stmt = $this->pdo->prepare(
            'SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?'
        );
        $stmt->execute([$table, $column]);
        if ((int) $stmt->fetchColumn() > 0) {
            return;
        }
        $this->pdo->exec("ALTER TABLE `$table` $addSql");
    }

    private function ensureIndex(string $table, string $index, string $addSql): void {
        $stmt = $this->pdo->prepare(
            'SELECT COUNT(*) FROM information_schema.STATISTICS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?'
        );
        $stmt->execute([$table, $index]);
        if ((int) $stmt->fetchColumn() > 0) {
            return;
        }
        try {
            $this->pdo->exec("ALTER TABLE `$table` $addSql");
        } catch (PDOException $e) {
            // ignore race / already exists
        }
    }
}
