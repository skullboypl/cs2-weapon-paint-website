<?php
/**
 * Lightweight anti-abuse + read response cache.
 * - Rate limit: per IP (+ steamid when logged in), file counters under storage/ratelimit
 * - Read cache: short TTL keyed by steamid + action; skipped when player revision changes
 *   (revision bumps on any write so MySQL is not hit for identical bootstrap/list spam)
 */
require_once __DIR__ . '/SessionBootstrap.php';

function wp_client_ip(): string
{
    $candidates = [
        $_SERVER['HTTP_CF_CONNECTING_IP'] ?? null,
        $_SERVER['HTTP_X_FORWARDED_FOR'] ?? null,
        $_SERVER['REMOTE_ADDR'] ?? null,
    ];
    foreach ($candidates as $raw) {
        if ($raw === null || $raw === '') {
            continue;
        }
        // X-Forwarded-For may be a list
        $ip = trim(explode(',', (string) $raw)[0]);
        if (filter_var($ip, FILTER_VALIDATE_IP)) {
            return $ip;
        }
    }
    return '0.0.0.0';
}

function wp_storage_subdir(string $name): string
{
    $dir = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'storage' . DIRECTORY_SEPARATOR . $name;
    if (!is_dir($dir)) {
        @mkdir($dir, 0775, true);
    }
    return $dir;
}

function wp_api_rate_limit_max(): int
{
    return defined('API_RATE_LIMIT') ? max(0, (int) API_RATE_LIMIT) : 120;
}

function wp_api_rate_window(): int
{
    return defined('API_RATE_WINDOW') ? max(1, (int) API_RATE_WINDOW) : 60;
}

function wp_api_read_cache_ttl(): int
{
    return defined('API_READ_CACHE_TTL') ? max(0, (int) API_READ_CACHE_TTL) : 5;
}

function wp_cache_version_path(): string
{
    return wp_storage_subdir('cache') . DIRECTORY_SEPARATOR . 'CACHE_VERSION';
}

/**
 * Build/deploy cache generation id.
 * Written by scripts/bump-cache-version.mjs on `pnpm dev` and `pnpm release`.
 * Embedded in every cached body so old files after restart/release never HIT.
 */
function wp_cache_build_id(): string
{
    static $id = null;
    if ($id !== null) {
        return $id;
    }
    $path = wp_cache_version_path();
    if (is_file($path)) {
        $raw = trim((string) @file_get_contents($path));
        if ($raw !== '') {
            $id = $raw;
            return $id;
        }
    }
    $id = 'fallback-' . dechex(time()) . '-' . bin2hex(random_bytes(2));
    @file_put_contents($path, $id . "\n", LOCK_EX);
    return $id;
}

/** Wipe all read-cache bodies + player revisions (keeps CACHE_VERSION). */
function wp_api_clear_all_caches(): void
{
    $dir = wp_storage_subdir('cache');
    foreach (glob($dir . DIRECTORY_SEPARATOR . 'body_*.json') ?: [] as $file) {
        @unlink($file);
    }
    foreach (glob($dir . DIRECTORY_SEPARATOR . 'rev_*.txt') ?: [] as $file) {
        @unlink($file);
    }
}

/**
 * Fixed-window rate limit. Exits with 429 when exceeded.
 * @param string|null $steamid optional logged-in id (tightens bucket)
 */
function wp_enforce_rate_limit(?string $steamid = null): void
{
    $max = wp_api_rate_limit_max();
    if ($max <= 0) {
        return;
    }
    $window = wp_api_rate_window();
    $ip = wp_client_ip();
    $bucket = hash('sha256', $ip . '|' . ($steamid ?? '-'));
    $path = wp_storage_subdir('ratelimit') . DIRECTORY_SEPARATOR . $bucket . '.json';
    $now = time();

    $fp = @fopen($path, 'c+');
    if ($fp === false) {
        return; // fail open if storage not writable
    }
    try {
        if (!flock($fp, LOCK_EX)) {
            return;
        }
        $raw = stream_get_contents($fp);
        $data = $raw ? json_decode($raw, true) : null;
        if (!is_array($data) || !isset($data['start'], $data['count'])) {
            $data = ['start' => $now, 'count' => 0];
        }
        if (($now - (int) $data['start']) >= $window) {
            $data = ['start' => $now, 'count' => 0];
        }
        $data['count'] = (int) $data['count'] + 1;
        $count = $data['count'];

        ftruncate($fp, 0);
        rewind($fp);
        fwrite($fp, json_encode($data));
        fflush($fp);
        flock($fp, LOCK_UN);
    } finally {
        fclose($fp);
    }

    if ($count > $max) {
        $retry = max(1, $window - ($now - (int) ($data['start'] ?? $now)));
        header('Retry-After: ' . $retry);
        header('X-RateLimit-Limit: ' . $max);
        http_response_code(429);
        echo json_encode([
            'error' => 'Too many requests',
            'retry_after' => $retry,
        ]);
        exit;
    }
}

function wp_api_revision_file(string $steamid): string
{
    $safe = preg_replace('/[^0-9a-zA-Z_-]/', '', $steamid) ?: 'unknown';
    return wp_storage_subdir('cache') . DIRECTORY_SEPARATOR . 'rev_' . $safe . '.txt';
}

function wp_api_get_revision(string $steamid): string
{
    $path = wp_api_revision_file($steamid);
    if (!is_file($path)) {
        return '0';
    }
    $v = trim((string) @file_get_contents($path));
    return $v !== '' ? $v : '0';
}

/** Bump player revision and drop cached read bodies for that steamid. */
function wp_api_bust(string $steamid): void
{
    $path = wp_api_revision_file($steamid);
    $next = (string) (time() . '.' . mt_rand(1000, 9999));
    @file_put_contents($path, $next, LOCK_EX);

    $dir = wp_storage_subdir('cache');
    $safe = preg_replace('/[^0-9a-zA-Z_-]/', '', $steamid) ?: 'unknown';
    $prefix = 'body_' . $safe . '_';
    foreach (glob($dir . DIRECTORY_SEPARATOR . $prefix . '*.json') ?: [] as $file) {
        @unlink($file);
    }
}

function wp_api_cache_path(string $steamid, string $cacheKey): string
{
    $safe = preg_replace('/[^0-9a-zA-Z_-]/', '', $steamid) ?: 'unknown';
    $hash = hash('sha256', $cacheKey);
    return wp_storage_subdir('cache') . DIRECTORY_SEPARATOR . 'body_' . $safe . '_' . $hash . '.json';
}

/**
 * If a fresh cached body exists for this revision, send it (or 304) and return true.
 */
function wp_api_try_send_cache(string $steamid, string $cacheKey): bool
{
    $ttl = wp_api_read_cache_ttl();
    if ($ttl <= 0) {
        return false;
    }
    $path = wp_api_cache_path($steamid, $cacheKey);
    if (!is_file($path)) {
        return false;
    }
    $raw = @file_get_contents($path);
    $wrap = $raw ? json_decode($raw, true) : null;
    if (!is_array($wrap) || empty($wrap['body']) || empty($wrap['etag']) || empty($wrap['rev'])) {
        return false;
    }
    if ((int) ($wrap['expires'] ?? 0) < time()) {
        return false;
    }
    if ((string) $wrap['rev'] !== wp_api_get_revision($steamid)) {
        return false;
    }
    if ((string) ($wrap['build'] ?? '') !== wp_cache_build_id()) {
        @unlink($path);
        return false;
    }

    $etag = (string) $wrap['etag'];
    $inm = trim((string) ($_SERVER['HTTP_IF_NONE_MATCH'] ?? ''));
    if ($inm !== '' && $inm === $etag) {
        header('ETag: ' . $etag);
        header('X-WP-Cache: HIT-304');
        http_response_code(304);
        return true;
    }

    header('ETag: ' . $etag);
    header('X-WP-Cache: HIT');
    header('Cache-Control: private, max-age=0, must-revalidate');
    echo $wrap['body'];
    return true;
}

function wp_api_store_cache(string $steamid, string $cacheKey, string $jsonBody): void
{
    $ttl = wp_api_read_cache_ttl();
    if ($ttl <= 0 || $jsonBody === '') {
        return;
    }
    // Do not cache error payloads
    $probe = json_decode($jsonBody, true);
    if (!is_array($probe) || isset($probe['error']) || isset($probe['errorDB'])) {
        return;
    }
    $rev = wp_api_get_revision($steamid);
    $build = wp_cache_build_id();
    $etag = '"' . sha1($build . '|' . $rev . '|' . $cacheKey . '|' . $jsonBody) . '"';
    $wrap = [
        'build' => $build,
        'rev' => $rev,
        'etag' => $etag,
        'expires' => time() + $ttl,
        'body' => $jsonBody,
    ];
    @file_put_contents(wp_api_cache_path($steamid, $cacheKey), json_encode($wrap), LOCK_EX);
    header('ETag: ' . $etag);
    header('X-WP-Cache: MISS');
    header('Cache-Control: private, max-age=0, must-revalidate');
}

/**
 * Capture switch echo for a read action: try cache first, else buffer producer output.
 * Usage:
 *   if (wp_api_begin_read_cache($steamid, $key)) { ... produce echo ...; wp_api_end_read_cache(...); }
 */
function wp_api_begin_read_cache(string $steamid, string $cacheKey): bool
{
    if (wp_api_try_send_cache($steamid, $cacheKey)) {
        return false; // already sent - caller should exit
    }
    ob_start();
    $GLOBALS['__wp_api_cache_key'] = $cacheKey;
    $GLOBALS['__wp_api_cache_steamid'] = $steamid;
    return true;
}

function wp_api_end_read_cache(): void
{
    $steamid = $GLOBALS['__wp_api_cache_steamid'] ?? null;
    $key = $GLOBALS['__wp_api_cache_key'] ?? null;
    unset($GLOBALS['__wp_api_cache_steamid'], $GLOBALS['__wp_api_cache_key']);
    if ($steamid === null || $key === null) {
        if (ob_get_level() > 0) {
            ob_end_flush();
        }
        return;
    }
    $json = ob_get_clean();
    if ($json === false) {
        return;
    }
    wp_api_store_cache((string) $steamid, (string) $key, $json);
    echo $json;
}
