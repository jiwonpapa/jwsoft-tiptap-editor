<?php

namespace Plugins\Jwsoft\TiptapEditor\Services {
    final class ResolverDnsFixture
    {
        /** @var list<array{ip?: string, ipv6?: string}>|false */
        public static array|false $records = [];
    }

    // Resolve the production DNS branch without reaching any real network.
    function dns_get_record(string $host, int $type): array|false
    {
        if ($host !== 'proof.example' || $type !== (DNS_A | DNS_AAAA)) {
            throw new \RuntimeException('Unexpected DNS request in resolver test');
        }

        return ResolverDnsFixture::$records;
    }
}

namespace {
    use Plugins\Jwsoft\TiptapEditor\Exceptions\LinkPreviewException;
    use Plugins\Jwsoft\TiptapEditor\Services\DnsSafeUrlResolver;
    use Plugins\Jwsoft\TiptapEditor\Services\ResolverDnsFixture;

    require dirname(__DIR__, 2).'/vendor/autoload.php';

    function expectResolverRejected(DnsSafeUrlResolver $resolver, string $host): void
    {
        try {
            $resolver->resolve($host);
        } catch (LinkPreviewException) {
            return;
        }
        throw new RuntimeException('Non-public destination was accepted: '.$host.' '.json_encode(ResolverDnsFixture::$records));
    }

    $resolver = new DnsSafeUrlResolver();
    $blocked = [
        '100.64.0.0', '100.64.0.1', '100.127.255.255',
        '0.0.0.0', '0.1.2.3', '10.0.0.1', '127.0.0.1', '169.254.169.254',
        '172.16.0.1', '192.168.0.1', '192.0.0.1', '192.0.2.1',
        '198.18.0.1', '198.19.255.255', '198.51.100.1', '203.0.113.1',
        '224.0.0.1', '239.255.255.255', '240.0.0.1', '255.255.255.255',
        '::', '::1', 'fc00::1', 'fdff::1', 'fe80::1', 'ff02::1',
        '2001:db8::1', '2001::1', '2001:2::1', '2002:a00:1::',
        '::ffff:127.0.0.1', '::ffff:10.0.0.1', '::ffff:8.8.8.8',
        '64:ff9b::a00:1', '64:ff9b:1::a00:1', 'invalid-address',
    ];
    foreach ($blocked as $address) {
        if (filter_var($address, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4) !== false) {
            expectResolverRejected($resolver, $address);
        }
        $record = [str_contains($address, ':') ? 'ipv6' : 'ip' => $address];
        foreach ([[$record], [['ip' => '8.8.8.8'], $record], [$record, ['ip' => '8.8.8.8']]] as $records) {
            ResolverDnsFixture::$records = $records;
            expectResolverRejected($resolver, 'proof.example');
        }
    }

    $allowed = ['8.8.8.8', '1.1.1.1', '100.63.255.255', '100.128.0.0', '2606:4700:4700::1111', '2001:4860:4860::8888'];
    foreach ($allowed as $address) {
        ResolverDnsFixture::$records = [[str_contains($address, ':') ? 'ipv6' : 'ip' => $address]];
        if ($resolver->resolve(' PROOF.EXAMPLE. ') !== $address) {
            throw new RuntimeException('Public DNS result was changed or rejected');
        }
        if (! str_contains($address, ':') && $resolver->resolve($address) !== $address) {
            throw new RuntimeException('Public literal IP was changed or rejected');
        }
    }
    foreach ([[], false, [[]]] as $records) {
        ResolverDnsFixture::$records = $records;
        expectResolverRejected($resolver, 'proof.example');
    }
    foreach (['', 'localhost:443', 'proof.example/path', '8.8.8.8@proof.example', '[::1]'] as $host) {
        expectResolverRejected($resolver, $host);
    }

    echo '[jwsoft] DNS public IP boundary passed: '.count($blocked).' blocked / '.count($allowed)." allowed address cases; mixed A/AAAA fail closed\n";
}
