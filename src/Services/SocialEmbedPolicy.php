<?php

namespace Plugins\Jwsoft\TiptapEditor\Services;

use Plugins\Jwsoft\TiptapEditor\Generated\EditorPolicy;

final class SocialEmbedPolicy
{
    /** @return array{provider: string, url: string}|null */
    public static function normalize(string $value): ?array
    {
        if (strlen($value) > 2048 || preg_match('/[\x00-\x20\x7f\\\\]/', $value)) return null;
        $parts = parse_url($value);
        if ($parts === false || strtolower($parts['scheme'] ?? '') !== 'https'
            || isset($parts['port']) || isset($parts['user']) || isset($parts['pass'])) return null;
        $host = strtolower($parts['host'] ?? '');
        $path = $parts['path'] ?? '';
        foreach (EditorPolicy::POLICY['externalEmbeds'] as $provider => $policy) {
            if (!in_array($host, $policy['hosts'], true)) continue;
            if ($provider === 'facebook') {
                foreach ([$policy['photo'], $policy['permalink'], $policy['watch']] as $format) {
                    if (!in_array($path, $format['paths'], true)) continue;
                    $id = self::queryId($parts['query'] ?? '', $format['idParameter'], $format['idPattern']);
                    if ($id === null) return null;
                    $query = $format['idParameter'].'='.$id;
                    if (isset($format['ownerParameter'])) {
                        $owner = self::queryId($parts['query'] ?? '', $format['ownerParameter'], $format['ownerPattern']);
                        if ($owner === null) return null;
                        $query .= '&'.$format['ownerParameter'].'='.$owner;
                    }
                    return ['provider' => $provider, 'url' => 'https://'.$policy['canonicalHost'].$format['canonicalPath'].'?'.$query];
                }
                if (preg_match('~'.$policy['reelPattern'].'~D', $path, $reel) === 1) {
                    return ['provider' => $provider, 'url' => 'https://'.$policy['canonicalHost'].'/reel/'.$reel[1]];
                }
            }
            if (preg_match('~'.$policy['pathPattern'].'~D', $path, $match) !== 1) return null;
            $canonicalPath = $provider === 'facebook' ? '/'.$match[1].'/'.$match[2].'/'.$match[3] : rtrim($path, '/');
            return ['provider' => $provider, 'url' => 'https://'.$policy['canonicalHost'].$canonicalPath];
        }
        return null;
    }

    /** Strict redirect inputs are resolved on the server, never passed directly to an SDK. */
    public static function facebookRedirectUrl(string $value): ?string
    {
        if (strlen($value) > 2048 || preg_match('/[\x00-\x20\x7f\\\\]/', $value)) return null;
        $parts = parse_url($value);
        if ($parts === false || strtolower($parts['scheme'] ?? '') !== 'https'
            || isset($parts['port']) || isset($parts['user']) || isset($parts['pass'])) return null;
        $host = strtolower($parts['host'] ?? '');
        $path = $parts['path'] ?? '';
        $policy = EditorPolicy::POLICY['externalEmbeds']['facebook'];
        $redirect = $policy['redirects'];
        if ($host === $redirect['shortHost']) {
            $pattern = $redirect['shortPathPattern'];
        } elseif (in_array($host, $policy['hosts'], true)) {
            $host = $policy['canonicalHost'];
            $pattern = $redirect['pathPattern'];
        } else return null;
        return preg_match('~'.$pattern.'~D', $path) === 1 ? 'https://'.$host.rtrim($path, '/').'/' : null;
    }

    private static function queryId(string $query, string $name, string $pattern): ?string
    {
        $ids = [];
        // Do not use parse_str: it silently collapses duplicate query keys.
        foreach (explode('&', $query) as $parameter) {
            $pair = explode('=', $parameter, 2);
            if (urldecode($pair[0]) === $name) $ids[] = urldecode($pair[1] ?? '');
        }
        return count($ids) === 1 && preg_match('~'.$pattern.'~D', $ids[0]) === 1 ? $ids[0] : null;
    }
}
