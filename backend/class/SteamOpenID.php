<?php
/** Steam-only OpenID 2.0 verification: no discovery or user-supplied network destinations. */
final class SteamOpenID {
    public const ENDPOINT = 'https://steamcommunity.com/openid/login';
    public static function loginUrl(string $returnUrl, string $realm): string {
        return self::ENDPOINT . '?' . http_build_query([
            'openid.ns' => 'http://specs.openid.net/auth/2.0',
            'openid.mode' => 'checkid_setup',
            'openid.return_to' => $returnUrl,
            'openid.realm' => $realm,
            'openid.identity' => 'http://specs.openid.net/auth/2.0/identifier_select',
            'openid.claimed_id' => 'http://specs.openid.net/auth/2.0/identifier_select',
        ]);
    }
    public static function assertion(array $query, string $returnUrl): ?array {
        $required = ['op_endpoint','claimed_id','identity','return_to','response_nonce','assoc_handle'];
        foreach (array_merge($required, ['ns','mode','signed','sig']) as $field) {
            if (!isset($query['openid_' . $field]) || !is_string($query['openid_' . $field])) { return null; }
        }
        if ($query['openid_mode'] !== 'id_res' || $query['openid_ns'] !== 'http://specs.openid.net/auth/2.0'
            || $query['openid_op_endpoint'] !== self::ENDPOINT || !hash_equals($returnUrl, $query['openid_return_to'])
            || $query['openid_identity'] !== $query['openid_claimed_id']
            || !preg_match('~^https://steamcommunity\.com/openid/id/(7656119[0-9]{10})$~D', $query['openid_claimed_id'], $match)) { return null; }
        $nonce = $query['openid_response_nonce'];
        if (!preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z.+$/D', $nonce)) { return null; }
        $time = strtotime(substr($nonce, 0, 20));
        if (!$time || abs(time() - $time) > 300) { return null; }
        $signed = explode(',', $query['openid_signed']);
        if (array_diff($required, $signed)) { return null; }
        $params = ['openid.ns' => $query['openid_ns'], 'openid.mode' => 'check_authentication', 'openid.signed' => $query['openid_signed'], 'openid.sig' => $query['openid_sig']];
        foreach ($signed as $field) {
            if (!preg_match('/^[a-z_]+$/D', $field) || !isset($query['openid_' . $field]) || !is_string($query['openid_' . $field])) { return null; }
            $params['openid.' . $field] = $query['openid_' . $field];
        }
        return ['steamid' => $match[1], 'params' => $params];
    }
    public static function verify(array $query, string $returnUrl): ?string {
        $assertion = self::assertion($query, $returnUrl);
        if (!$assertion) { return null; }
        $curl = curl_init(self::ENDPOINT);
        curl_setopt_array($curl, [CURLOPT_POST => true, CURLOPT_POSTFIELDS => http_build_query($assertion['params']), CURLOPT_RETURNTRANSFER => true, CURLOPT_CONNECTTIMEOUT => 5, CURLOPT_TIMEOUT => 12, CURLOPT_FOLLOWLOCATION => false]);
        $response = curl_exec($curl);
        $status = curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
        unset($curl);
        return $status === 200 && is_string($response) && preg_match('/^is_valid:true\s*$/m', $response) ? $assertion['steamid'] : null;
    }
}
