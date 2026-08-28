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
            FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE,
        ) === false) {
            throw new LinkPreviewException('preview_private_address');
        }

        return $address;
    }
}
