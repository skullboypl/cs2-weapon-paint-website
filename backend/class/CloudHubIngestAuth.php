<?php
final class CloudHubIngestAuth {
    public static function signature(string $key, string $server, string $timestamp, string $body): string {
        return hash_hmac('sha256', "v1\n$server\n$timestamp\n" . hash('sha256', $body), $key);
    }
    public static function verify(array $headers, string $body, array $keys, int $now): string {
        $server = $headers['server'] ?? ''; $stamp = $headers['timestamp'] ?? ''; $mac = $headers['signature'] ?? '';
        if (!is_string($server) || !preg_match('/^[a-zA-Z0-9_-]{1,64}$/D',$server) ||
            !is_string($stamp) || !preg_match('/^[0-9]{10}$/D',$stamp) || abs($now-(int)$stamp)>300 ||
            !is_string($mac) || !preg_match('/^[a-f0-9]{64}$/D',$mac) ||
            !isset($keys[$server]) || !is_string($keys[$server]) || strlen($keys[$server])<32 ||
            !hash_equals(self::signature($keys[$server],$server,$stamp,$body),$mac)) {
            throw new InvalidArgumentException('Invalid server authentication');
        }
        return $server;
    }
}
