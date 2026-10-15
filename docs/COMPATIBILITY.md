# WeaponPaints compatibility

Reference: Nereziel/cs2-WeaponPaints commit `6b1039d63042b0bbadbf142054c86f79284fdb6a`. Inspected read-only: `Utility.CheckDatabaseTables` and `WeaponSynchronization.cs`.

| Data | Shared representation |
| --- | --- |
| Skins | `wp_player_skins`, unique `(steamid, weapon_team, weapon_defindex)` |
| Teams | T = 2, CT = 3 |
| Paint / wear / seed | `weapon_paint_id`, `weapon_wear` 0..1, `weapon_seed` 0..1000 |
| StatTrak | `weapon_stattrak`, `weapon_stattrak_count` |
| Stickers | Five slots, `id;schema;x;y;wear;scale;rotation` |
| Charms | `weapon_keychain`: `id;x;y;z;seed` |
| Knives | `wp_player_knife.knife`, canonical `weapon_*` |
| Gloves | `wp_player_gloves`, corresponding paint in `wp_player_skins` |
| Agents | `wp_player_agents.agent_t` / `agent_ct` |
| Music / pins | `wp_player_music.music_id` / `wp_player_pins.id`, per team |
| Web-only features | `wp_users_data` and `wp_saved_loadouts` |

The six plugin tables match the referenced upstream schema. Local integration tests exercise the real PHP/MariaDB API, including serialization and user/team isolation. No game server was started or modified. In-game refresh must still be verified with the plugin version actually deployed; this is shared-database integration, not push/RCON synchronization.

The fifth sticker slot and optional 3D preview retain their beta status. Optimized copies of 13,460 available upstream images are included in the production bundle; one upstream entry (collectible 5180) has no artwork and uses an explicit preview-unavailable placeholder. Asset preparation is repeatable and pins the upstream commit. Missing source images are reported rather than silently substituted.

Graphics belong to Valve and their respective owners and are sourced from Nereziel/cs2-WeaponPaints. CloudHub is not affiliated with Valve or Steam and does not modify Steam inventory.
