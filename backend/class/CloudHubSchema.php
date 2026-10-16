<?php
/** CLI-only, resumable additive migrations. Never called by HTTP requests. */
final class CloudHubSchema {
    public static function migrate(PDO $db, string $directory): void {
        if (PHP_SAPI !== 'cli') { throw new LogicException('CLI only'); }
        $lock = 'cloudhub-schema-' . substr(hash('sha256', (string)$db->query('SELECT DATABASE()')->fetchColumn()), 0, 32);
        $stmt = $db->prepare('SELECT GET_LOCK(?, 10)');
        $stmt->execute([$lock]);
        if ((int)$stmt->fetchColumn() !== 1) { throw new RuntimeException('Migration lock unavailable'); }
        try {
            $db->exec('CREATE TABLE IF NOT EXISTS cloudhub_schema_migrations (version VARCHAR(128) PRIMARY KEY, sha256 CHAR(64) NOT NULL, applied_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)) ENGINE=InnoDB');
            $files = glob($directory . '/*.sql');
            if (!$files) { throw new RuntimeException('Migration files missing'); }
            sort($files, SORT_STRING);
            foreach ($files as $file) {
                $version = basename($file);
                $hash = hash_file('sha256', $file);
                $stmt = $db->prepare('SELECT sha256 FROM cloudhub_schema_migrations WHERE version=?');
                $stmt->execute([$version]);
                $existing = $stmt->fetchColumn();
                if ($existing !== false) {
                    if (!hash_equals($existing, $hash)) { throw new RuntimeException('Applied migration checksum mismatch: ' . $version); }
                    continue;
                }
                // DDL auto-commits in MariaDB. Each statement is repeatable after interruption.
                foreach (explode(';', file_get_contents($file)) as $sql) {
                    if (trim($sql) !== '') { $db->exec($sql); }
                }
                $db->prepare('INSERT INTO cloudhub_schema_migrations(version,sha256) VALUES (?,?)')->execute([$version,$hash]);
            }
        } finally {
            $db->prepare('SELECT RELEASE_LOCK(?)')->execute([$lock]);
        }
    }
}
