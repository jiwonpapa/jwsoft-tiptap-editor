<?php

use Illuminate\Http\Client\Factory;
use Plugins\Jwsoft\TiptapEditor\Exceptions\LinkPreviewException;
use Plugins\Jwsoft\TiptapEditor\Services\Contracts\SafeUrlResolverInterface;
use Plugins\Jwsoft\TiptapEditor\Services\DnsSafeUrlResolver;
use Plugins\Jwsoft\TiptapEditor\Services\LinkPreviewService;

$g7Root = $argv[1] ?? '';
$projectRoot = $argv[2] ?? '';
require $g7Root.'/vendor/autoload.php';
require $projectRoot.'/vendor/autoload.php';

function assertLinkPreview(bool $condition, string $message): void
{
    if (! $condition) {
        throw new RuntimeException($message);
    }
}

final class TestSafeUrlResolver implements SafeUrlResolverInterface
{
    /** @var list<string> */
    public array $hosts = [];

    public function resolve(string $host): string
    {
        $this->hosts[] = $host;
        if (in_array($host, ['127.0.0.1', 'localhost'], true)) {
            throw new LinkPreviewException('private address');
        }

        return '93.184.216.34';
    }
}

$resolver = new TestSafeUrlResolver();
$http = new Factory();
$http->fake(function ($request) use ($http) {
    if ($request->url() === 'https://www.instagram.com/p/proof') {
        return $http->response(
            '<html><head>'
            .'<meta property="og:title" content="Proof &amp; &lt;b&gt;unsafe&lt;/b&gt;">'
            .'<meta property="og:description" content="  Safe   preview  description ">'
            .'<meta property="og:image" content="https://www.instagram.com/media/proof.jpg">'
            .'</head></html>',
            200,
            ['Content-Type' => 'text/html; charset=UTF-8'],
        );
    }
    if ($request->url() === 'https://redirect.example/start') {
        return $http->response('', 302, ['Location' => 'https://127.0.0.1/admin']);
    }
    if ($request->url() === 'https://x.com/jwsoft/status/123') {
        return $http->response('rate limited', 429, ['Content-Type' => 'text/plain']);
    }
    if ($request->url() === 'https://www.facebook.com/no-metadata') {
        return $http->response('<html><title>Facebook</title></html>', 200, ['Content-Type' => 'text/html']);
    }
    if ($request->url() === 'https://huge.example/page') {
        return $http->response(str_repeat('x', 524289), 200, ['Content-Type' => 'text/html']);
    }

    return $http->response('not found', 404, ['Content-Type' => 'text/plain']);
});
$service = new LinkPreviewService($http, $resolver);
$preview = $service->preview('https://www.instagram.com/p/proof#tracking', [
    'social' => true,
    'generic' => true,
    'images' => true,
]);
assertLinkPreview($preview['provider'] === 'instagram', 'Instagram provider classification failed');
assertLinkPreview($preview['title'] === 'Proof & unsafe', 'preview title must be decoded and stripped');
assertLinkPreview($preview['description'] === 'Safe preview description', 'preview whitespace must be normalized');
assertLinkPreview($preview['image_url'] === 'https://www.instagram.com/media/proof.jpg', 'same-host preview image should survive');
assertLinkPreview($resolver->hosts === ['www.instagram.com', 'www.instagram.com'], 'page and image host must both pass public resolver');

foreach (['https://x.com/jwsoft/status/123', 'https://www.facebook.com/no-metadata'] as $url) {
    try {
        $service->preview($url, ['social' => true, 'generic' => true, 'images' => false]);
        throw new RuntimeException('unavailable social metadata must fail explicitly, not produce an empty successful card');
    } catch (LinkPreviewException) {
        // The client keeps the original URL and offers retry, without fabricating metadata.
    }
}

try {
    $service->preview('https://example.com/article', ['social' => true, 'generic' => false, 'images' => false]);
    throw new RuntimeException('generic preview should respect setting gate');
} catch (LinkPreviewException) {
    // expected
}
try {
    $service->preview('https://redirect.example/start', ['social' => true, 'generic' => true, 'images' => false]);
    throw new RuntimeException('redirect to private address should be rejected');
} catch (LinkPreviewException) {
    // expected
}
try {
    $service->preview('https://huge.example/page', ['social' => true, 'generic' => true, 'images' => false]);
    throw new RuntimeException('oversized preview response should be rejected');
} catch (LinkPreviewException) {
    // expected
}
try {
    (new DnsSafeUrlResolver())->resolve('127.0.0.1');
    throw new RuntimeException('literal private IP should be rejected');
} catch (LinkPreviewException) {
    // expected
}

echo "[jwsoft] G7 link preview provider, metadata, setting, redirect, and SSRF gates passed\n";
