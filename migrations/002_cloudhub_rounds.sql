-- Explicit CLI migration only. No WeaponPaints table changes.
CREATE TABLE IF NOT EXISTS cloudhub_reward_rules (
 rule_key VARCHAR(48) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 value INT NOT NULL
) ENGINE=InnoDB;
INSERT IGNORE INTO cloudhub_reward_rules VALUES
 ('min_players',4),('min_round_seconds',30),('min_active_seconds',10),
 ('pair_window_seconds',600),('pair_max_kills',3),
 ('hourly_rp_cap',500),('hourly_cc_cap',100),
 ('kill_rp',10),('kill_cc',2),('headshot_rp',3),('headshot_cc',1),
 ('assist_rp',4),('assist_cc',1),('death_rp',-2),('teamkill_rp',-20),
 ('round_win_rp',5),('round_win_cc',2),('round_play_rp',1),('round_play_cc',1);
CREATE TABLE IF NOT EXISTS cloudhub_round_receipts (
 server_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 round_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 event_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 ended_at BIGINT NOT NULL,
 result_json JSON NOT NULL,
 PRIMARY KEY(server_id,round_id),
 UNIQUE KEY event_receipt(server_id,event_id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS cloudhub_combat_history (
 server_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 round_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 killer CHAR(17) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 victim CHAR(17) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 ended_at BIGINT NOT NULL,
 PRIMARY KEY(server_id,round_id,victim),
 INDEX pair_window(killer,victim,ended_at)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS cloudhub_round_awards (
 server_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 round_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 steamid CHAR(17) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 ended_at BIGINT NOT NULL,
 rp_delta INT NOT NULL,
 coins INT NOT NULL CHECK(coins>=0),
 PRIMARY KEY(server_id,round_id,steamid),
 INDEX reward_window(steamid,ended_at),
 FOREIGN KEY(steamid) REFERENCES cloudhub_players(steamid)
) ENGINE=InnoDB;
