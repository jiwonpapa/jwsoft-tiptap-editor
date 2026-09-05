<?php

namespace Plugins\Jwsoft\TiptapEditor\Services;

use Plugins\Jwsoft\TiptapEditor\Exceptions\LinkPreviewException;
use Plugins\Jwsoft\TiptapEditor\Services\Contracts\SafeUrlResolverInterface;

class DnsSafeUrlResolver implements SafeUrlResolverInterface
{
    public function resolve(string $host): string
    {
        $host = strtolower(rtrim(trim($host), '.'));
        if ($host === '' || strlen($host) > 253 || preg_match('/^[a-z0-9.-]+$/', $host) !== 1) {
            throw new LinkPreviewException('preview_host_rejected');
        }
        if (filter_var($host, FILTER_VALIDATE_IP) !== false) {
            return $this->requirePublicIp($host);
        }

        $records = dns_get_record($host, DNS_A | DNS_AAAA);
        if (! is_array($records) || $records === []) {
            throw new LinkPreviewException('preview_dns_failed');
        }
        $addresses = [];
        foreach ($records as $record) {
            $address = $record['ip'] ?? $record['ipv6'] ?? null;
            if (is_string($address)) {
                $addresses[] = $this->requirePublicIp($address);
            }
        }
        $addresses = array_values(array_unique($addresses));
        if ($addresses === []) {
            throw new LinkPreviewException('preview_dns_failed');
        }

        return $addresses[0];
    }

    private function requirePublicIp(string $address): string
    {
        if (filter_var(
            $address,
            FILTER_VALIDATE_IP,
            FILTER_FLAG_GLOBAL_RANGE,
        ) === false) {
            throw new LinkPreviewException('preview_private_address');
        }

        // HTTP destinations must be unicast. Limit IPv6 to native global unicast
        // (2000::/3), excluding mapped/NAT64 routes that can conceal an IPv4 target.
        $packed = inet_pton($address);
        if ($packed === false
            || (strlen($packed) === 4 && ord($packed[0]) >= 224)
            || (strlen($packed) === 16 && (ord($packed[0]) & 0xe0) !== 0x20)) {
            throw new LinkPreviewException('preview_private_address');
        }

        return $address;
    }
}
