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
                $this->requirePublicIp($address);
                // Unknown network-specific NAT64 prefixes can look globally routable.
                // Validate all DNS results, but only connect to a public IPv4 address.
                if (filter_var($address, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4) !== false) {
                    $addresses[] = $address;
                }
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

        // Reject non-unicast and known IPv6 translation ranges in mixed DNS answers.
        // Passing the IPv6 checks does not authorize connecting through that address.
        // PHP 8.2 accepts 6to4 (2002::/16); exclude that IPv4 tunnel explicitly.
        $packed = inet_pton($address);
        if ($packed === false
            || (strlen($packed) === 4 && ord($packed[0]) >= 224)
            || (strlen($packed) === 16 && ((ord($packed[0]) & 0xe0) !== 0x20
                || str_starts_with($packed, "\x20\x02")))) {
            throw new LinkPreviewException('preview_private_address');
        }

        return $address;
    }
}
