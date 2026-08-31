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
            if (preg_match('~'.$policy['pathPattern'].'~D', $path, $match) !== 1) return null;
            $canonicalPath = $provider === 'facebook' ? '/'.$match[1].'/'.$match[2].'/'.$match[3] : rtrim($path, '/');
            return ['provider' => $provider, 'url' => 'https://'.$policy['canonicalHost'].$canonicalPath];
        }
        return null;
    }
}
