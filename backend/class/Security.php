<?php
function wp_json_error(int $status, string $message): never {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode(['error' => $message]);
    exit;
}
function wp_csrf_token(): string {
    if (empty($_SESSION['csrf_token'])) { $_SESSION['csrf_token'] = bin2hex(random_bytes(32)); }
    return $_SESSION['csrf_token'];
}
function wp_require_post(): void {
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
        header('Allow: POST');
        wp_json_error(405, 'Use POST for this operation');
    }
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if (($origin !== '' && $origin !== rtrim(DOMAIN_NAME, '/')) || ($_SERVER['HTTP_SEC_FETCH_SITE'] ?? '') === 'cross-site') {
        wp_json_error(403, 'Origin not allowed');
    }
    $token = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    if (!is_string($token) || !hash_equals(wp_csrf_token(), $token)) {
        wp_json_error(403, 'Invalid session token. Reload the page and try again.');
    }
    if ((int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > 65536) { wp_json_error(413, 'Request too large'); }
    foreach ($_POST as $value) {
        if (!is_string($value) || strlen($value) > 4096) { wp_json_error(422, 'Invalid request field'); }
    }
}
function wp_number(string $field, float $min, float $max, bool $integer = false, $default = 0): float|int {
    $raw = $_POST[$field] ?? $default;
    if (!is_scalar($raw) || !is_numeric($raw)) { wp_json_error(422, 'Invalid ' . $field); }
    $v = (float) $raw;
    if (!is_finite($v) || $v < $min || $v > $max || ($integer && floor($v) !== $v)) { wp_json_error(422, 'Invalid ' . $field); }
    return $integer ? (int) $v : $v;
}
function wp_catalog(string $file): array {
    static $cache = [];
    if (isset($cache[$file])) { return $cache[$file]; }
    $root = dirname(__DIR__, 2);
    $path = is_dir($root . '/frontend/public') ? $root . '/frontend/public/' . $file : $root . '/' . $file;
    $data = json_decode((string) file_get_contents($path), true, 512, JSON_THROW_ON_ERROR);
    return $cache[$file] = $data;
}
function wp_validate_skin_input(string $action): void {
    if (in_array($action, ['save', 'gloves_save'], true)) {
        $def = wp_number('weapon_defindex', $action === 'save' ? 1 : 0, 65535, true);
        $paint = wp_number('paint', 0, 100000, true);
        wp_number('wear', 0, 1);
        wp_number('seed', 0, 1000, true);
        $catalog = wp_catalog($action === 'save' ? 'data/skins_en.json' : 'data/gloves_en.json');
        $found = false;
        foreach ($catalog as $skin) {
            if ((int) $skin['weapon_defindex'] === $def && (int) $skin['paint'] === $paint) { $found = true; break; }
        }
        if (!$found) { wp_json_error(422, 'Unknown weapon and paint combination'); }
    }
    if ($action === 'save') {
        wp_number('stattrak', 0, 1, true);
        wp_number('stattrak_count', 0, 999999999, true);
        $nametag = $_POST['nametag'] ?? '';
        if (preg_match('//u', $nametag) !== 1 || preg_match_all('/./us', $nametag) > 20 || preg_match('/[\x00-\x1f\x7f]/', $nametag)) { wp_json_error(422, 'Nametag must be at most 20 characters'); }
        $keychain = wp_number('keychainId', 0, 100000, true);
        if ($keychain > 0 && !in_array($keychain, array_map('intval', array_column(wp_catalog('data/keychains_en.json'), 'id')), true)) { wp_json_error(422, 'Unknown keychain'); }
        foreach (['offsetX','offsetY','offsetZ'] as $field) { wp_number($field, -10, 10); }
        wp_number('keychainSeed', 0, 100000, true);
        $stickerIds = array_map('intval', array_column(wp_catalog('data/stickers_en.json'), 'id'));
        for ($i = 0; $i < 5; $i++) {
            $raw = $_POST['weapon_sticker_' . $i] ?? '0';
            $parts = explode(';', $raw);
            if (!in_array(count($parts), [1, 7], true) || strlen($raw) > 128) { wp_json_error(422, 'Invalid sticker format'); }
            $bounds = [[0,100000],[0,100000],[-10,10],[-10,10],[0,1],[0,5],[-360,360]];
            foreach ($parts as $n => $part) {
                if (!is_numeric($part) || !is_finite((float)$part) || (float)$part < $bounds[$n][0] || (float)$part > $bounds[$n][1]) { wp_json_error(422, 'Invalid sticker value'); }
            }
            $id = (float)$parts[0];
            if (floor($id) !== $id || ($id > 0 && !in_array((int)$id, $stickerIds, true))) { wp_json_error(422, 'Unknown sticker'); }
        }
    }
    if ($action === 'agent_save') {
        $team = wp_number('agent_team', 2, 3, true);
        if ($team !== (($_POST['team'] ?? '') === 'T' ? 2 : 3)) { wp_json_error(422, 'Agent team does not match selected team'); }
        foreach (wp_catalog('data/agents_en.json') as $agent) {
            if ((int)$agent['team'] === $team && $agent['model'] === ($_POST['agent_model'] ?? '')) { return; }
        }
        wp_json_error(422, 'Unknown agent');
    }
    foreach (['music_save' => ['music_id','data/music_en.json'], 'pin_save' => ['pin_id','data/collectibles_en.json']] as $kind => [$field,$file]) {
        if ($action !== $kind) { continue; }
        $id = wp_number($field, 0, 100000, true);
        if ($id > 0 && !in_array($id, array_map('intval', array_column(wp_catalog($file), 'id')), true)) { wp_json_error(422, 'Unknown item'); }
    }
}
