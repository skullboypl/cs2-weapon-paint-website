-- Additive schema only. Never modifies wp_* tables.
CREATE TABLE IF NOT EXISTS cloudhub_players (
 steamid CHAR(17) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 nickname VARCHAR(128) NOT NULL DEFAULT 'Player',
 avatar_url VARCHAR(512) NULL,
 first_seen_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 last_seen_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 steam_verified_at DATETIME(6) NULL,
 INDEX idx_players_nickname (nickname), INDEX idx_players_activity (last_seen_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS cloudhub_profiles (
 steamid CHAR(17) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 bio VARCHAR(1000) NOT NULL DEFAULT '',
 theme VARCHAR(32) NOT NULL DEFAULT 'cloudhub',
 banner VARCHAR(64) NOT NULL DEFAULT 'default',
 profile_visibility ENUM('public','friends','private') NOT NULL DEFAULT 'public',
 collection_visibility ENUM('public','friends','private') NOT NULL DEFAULT 'private',
 activity_visibility ENUM('public','friends','private') NOT NULL DEFAULT 'private',
 comments_policy ENUM('everyone','friends','disabled') NOT NULL DEFAULT 'disabled',
 FOREIGN KEY (steamid) REFERENCES cloudhub_players(steamid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS cloudhub_roles (
 role VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY
) ENGINE=InnoDB;
INSERT IGNORE INTO cloudhub_roles(role) VALUES ('PLAYER'),('MODERATOR'),('ADMIN'),('OWNER');
CREATE TABLE IF NOT EXISTS cloudhub_player_roles (
 steamid CHAR(17) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 role VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 granted_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 PRIMARY KEY (steamid,role), FOREIGN KEY (steamid) REFERENCES cloudhub_players(steamid),
 FOREIGN KEY (role) REFERENCES cloudhub_roles(role)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS cloudhub_role_permissions (
 role VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 permission VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 PRIMARY KEY (role,permission), FOREIGN KEY (role) REFERENCES cloudhub_roles(role)
) ENGINE=InnoDB;
INSERT IGNORE INTO cloudhub_role_permissions VALUES
 ('MODERATOR','moderation.manage'),('ADMIN','moderation.manage'),('ADMIN','players.read');
CREATE TABLE IF NOT EXISTS cloudhub_rank_config (
 rank_key VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 name VARCHAR(48) NOT NULL,
 min_rp BIGINT NOT NULL UNIQUE CHECK (min_rp >= 0),
 color CHAR(7) NOT NULL,
 icon VARCHAR(48) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT IGNORE INTO cloudhub_rank_config VALUES
 ('bronze','Bronze',0,'#CD7F32','shield'),('silver','Silver',500,'#C0C0C0','shield'),
 ('gold','Gold',1200,'#FFD700','shield'),('platinum','Platinum',2500,'#70D6D1','shield'),
 ('diamond','Diamond',4500,'#70B7FF','gem'),('master','Master',7500,'#B794F4','crown');
CREATE TABLE IF NOT EXISTS cloudhub_seasons (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 name VARCHAR(100) NOT NULL,
 starts_at DATETIME(6) NOT NULL,
 ends_at DATETIME(6) NOT NULL,
 status ENUM('planned','active','closed') NOT NULL DEFAULT 'planned',
 policy_json JSON NOT NULL,
 CHECK (ends_at > starts_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS cloudhub_player_stats (
 steamid CHAR(17) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 rp BIGINT NOT NULL DEFAULT 0 CHECK (rp >= 0),
 kills BIGINT UNSIGNED NOT NULL DEFAULT 0,
 deaths BIGINT UNSIGNED NOT NULL DEFAULT 0,
 assists BIGINT UNSIGNED NOT NULL DEFAULT 0,
 headshots BIGINT UNSIGNED NOT NULL DEFAULT 0,
 rounds_played BIGINT UNSIGNED NOT NULL DEFAULT 0,
 rounds_won BIGINT UNSIGNED NOT NULL DEFAULT 0,
 rounds_lost BIGINT UNSIGNED NOT NULL DEFAULT 0,
 matches_won BIGINT UNSIGNED NOT NULL DEFAULT 0,
 matches_lost BIGINT UNSIGNED NOT NULL DEFAULT 0,
 mvp BIGINT UNSIGNED NOT NULL DEFAULT 0,
 bombs_planted BIGINT UNSIGNED NOT NULL DEFAULT 0,
 bombs_defused BIGINT UNSIGNED NOT NULL DEFAULT 0,
 play_seconds BIGINT UNSIGNED NOT NULL DEFAULT 0,
 best_kill_streak INT UNSIGNED NOT NULL DEFAULT 0,
 FOREIGN KEY (steamid) REFERENCES cloudhub_players(steamid),
 INDEX idx_ranking (rp DESC,kills DESC,steamid)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS cloudhub_player_season_stats (
 season_id BIGINT UNSIGNED NOT NULL,
 steamid CHAR(17) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 rp BIGINT NOT NULL DEFAULT 0 CHECK (rp >= 0),
 kills BIGINT UNSIGNED NOT NULL DEFAULT 0,
 deaths BIGINT UNSIGNED NOT NULL DEFAULT 0,
 assists BIGINT UNSIGNED NOT NULL DEFAULT 0,
 headshots BIGINT UNSIGNED NOT NULL DEFAULT 0,
 rounds_played BIGINT UNSIGNED NOT NULL DEFAULT 0,
 rounds_won BIGINT UNSIGNED NOT NULL DEFAULT 0,
 rounds_lost BIGINT UNSIGNED NOT NULL DEFAULT 0,
 matches_won BIGINT UNSIGNED NOT NULL DEFAULT 0,
 matches_lost BIGINT UNSIGNED NOT NULL DEFAULT 0,
 mvp BIGINT UNSIGNED NOT NULL DEFAULT 0,
 bombs_planted BIGINT UNSIGNED NOT NULL DEFAULT 0,
 bombs_defused BIGINT UNSIGNED NOT NULL DEFAULT 0,
 play_seconds BIGINT UNSIGNED NOT NULL DEFAULT 0,
 best_kill_streak INT UNSIGNED NOT NULL DEFAULT 0,
 final_position BIGINT UNSIGNED NULL,
 PRIMARY KEY(season_id,steamid),
 FOREIGN KEY (steamid) REFERENCES cloudhub_players(steamid),
 FOREIGN KEY (season_id) REFERENCES cloudhub_seasons(id),
 INDEX idx_season_ranking(season_id,rp DESC,kills DESC,steamid)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS cloudhub_wallets (
 steamid CHAR(17) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 balance BIGINT NOT NULL DEFAULT 0 CHECK (balance >= 0),
 FOREIGN KEY (steamid) REFERENCES cloudhub_players(steamid)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS cloudhub_wallet_transactions (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 operation_key VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE,
 steamid CHAR(17) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 amount BIGINT NOT NULL CHECK (amount <> 0),
 balance_before BIGINT NOT NULL CHECK (balance_before >= 0),
 balance_after BIGINT NOT NULL CHECK (balance_after >= 0),
 source VARCHAR(48) NOT NULL,
 reason VARCHAR(500) NOT NULL,
 actor_steamid CHAR(17) CHARACTER SET ascii COLLATE ascii_bin NULL,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 CHECK (balance_after = balance_before + amount),
 FOREIGN KEY (steamid) REFERENCES cloudhub_players(steamid),
 FOREIGN KEY (actor_steamid) REFERENCES cloudhub_players(steamid),
 INDEX idx_wallet_history(steamid,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS cloudhub_processed_events (
 server_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 event_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 payload_sha256 CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 processed_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 PRIMARY KEY(server_id,event_id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS cloudhub_admin_audit_logs (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 actor_steamid CHAR(17) CHARACTER SET ascii COLLATE ascii_bin NULL,
 target_steamid CHAR(17) CHARACTER SET ascii COLLATE ascii_bin NULL,
 action VARCHAR(64) NOT NULL,
 reason VARCHAR(500) NOT NULL,
 metadata_json JSON NOT NULL,
 created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
 INDEX idx_audit_target(target_steamid,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
