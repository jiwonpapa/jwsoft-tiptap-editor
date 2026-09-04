<?php

use Illuminate\Http\Client\Factory;
use Plugins\Jwsoft\TiptapEditor\Exceptions\LinkPreviewException;
use Plugins\Jwsoft\TiptapEditor\Services\Contracts\SafeUrlResolverInterface;
use Plugins\Jwsoft\TiptapEditor\Services\DnsSafeUrlResolver;
use Plugins\Jwsoft\TiptapEditor\Services\LinkPreviewService;
use Plugins\Jwsoft\TiptapEditor\Services\SocialEmbedPolicy;

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
foreach ([
    'https://x.com/a/status/20' => 'x',
    'https://www.facebook.com/facebook/posts/10154009990506729/' => 'facebook',
    'https://www.instagram.com/reel/C6H039Ctw_b/?utm_source=ig_embed' => 'instagram',
    'https://m.tiktok.com/@scout2015/video/6718335390845095173?is_copy_url=1' => 'tiktok',
] as $url => $provider) {
    $descriptor = $service->preview($url, ['social' => true, 'generic' => false, 'images' => false, 'embeds' => ['x' => true, 'facebook' => true, 'instagram' => true, 'tiktok' => true]]);
    assertLinkPreview($descriptor['provider'] === $provider && $descriptor['description'] === '' && $descriptor['image_url'] === null, 'embed descriptor must not fabricate fetched body or media');
}
assertLinkPreview($resolver->hosts === [], 'fixed public embed descriptors must not trigger server URL fetches');
$facebookCases = json_decode(file_get_contents($projectRoot.'/tests/fixtures/facebook-urls.json'), true, 512, JSON_THROW_ON_ERROR);
foreach ($facebookCases['allowed'] as $case) {
    $normalized = SocialEmbedPolicy::normalize($case['url']);
    assertLinkPreview($normalized === ['provider' => 'facebook', 'url' => $case['canonical']], 'Facebook normalization must match the client fixture and retain its ID');
    assertLinkPreview(SocialEmbedPolicy::normalize($normalized['url']) === $normalized, 'canonical Facebook URLs must round-trip');
    $descriptor = $service->preview($case['url'], ['social' => true, 'generic' => false, 'images' => false, 'embeds' => ['facebook' => true]]);
    assertLinkPreview($descriptor['url'] === $case['canonical'] && $descriptor['provider'] === 'facebook' && $descriptor['description'] === '' && $descriptor['image_url'] === null, 'Facebook descriptor must retain the ID, without fabricating or fetching a post');
}
foreach ($facebookCases['rejected'] as $url) {
    assertLinkPreview(SocialEmbedPolicy::normalize($url) === null, 'invalid or ambiguous Facebook URL must not become an executable embed');
}
assertLinkPreview($resolver->hosts === [], 'direct Facebook embed descriptors must not trigger arbitrary server URL fetches');
assertLinkPreview(SocialEmbedPolicy::normalize('https://www.facebook.com/ISS/posts/nasa-astronaut-megan-mcarthur/1194948136005111/')['url'] === 'https://www.facebook.com/ISS/posts/1194948136005111', 'Facebook copied slug URL must canonicalize to the public post ID');
foreach (['http://x.com/a/status/20','https://x.com:443/a/status/20','https://x.com@evil.test/a/status/20','https://x.com.evil.test/a/status/20','https://x.com./a/status/20','https://x.com/a/status/%32%30','https://facebook.com/plugins/post.php?href=https://evil.test','https://fb.watch/abc','https://facebook.com/groups/1/posts/2','https://instagram.com/explore/tags/test','https://tiktok.com/@user/photo/6718335390845095173'] as $url) {
    assertLinkPreview(SocialEmbedPolicy::normalize($url) === null, 'non-whitelisted URL must not become an executable embed');
}
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

// Facebook share wrappers must resolve only through pinned public Facebook hosts.
$shareHttp = new Factory();
$shareResolver = new TestSafeUrlResolver();
$shareTargets = [
    'https://www.facebook.com/share/p/ValidPost/' => 'https://www.facebook.com/SCAHIP/posts/pfbid0giL815w3L4zj7Ld7vguMdt1AMmMT1nSpByrY9mny8tJTW8XGFRz87UxtLxYWA6qEl?tracking=1',
    'https://www.facebook.com/share/v/ValidVideo/' => 'https://www.facebook.com/reel/1259297086299723/?ref=share',
    'https://fb.watch/ValidShort/' => 'https://www.facebook.com/share/v/ValidVideo/',
    'https://www.facebook.com/share/p/ExternalHost/' => 'https://evil.test/post',
    'https://www.facebook.com/share/p/PrivateHost/' => 'https://127.0.0.1/admin',
    'https://www.facebook.com/share/p/LoginRequired/' => 'https://www.facebook.com/login.php',
    'https://www.facebook.com/share/p/LoopRedirect/' => '/share/p/LoopRedirect/',
    'https://www.facebook.com/share/p/NoLocation/' => '',
    'https://www.facebook.com/share/p/UnavailablePost/' => null,
    'https://www.facebook.com/share/p/ConnectionTimeout/' => 'timeout',
];
$shareHttp->fake(function ($request) use ($shareHttp, $shareTargets) {
    assertLinkPreview($request->method() === 'HEAD', 'share resolution must not download a page body');
    assertLinkPreview(array_key_exists($request->url(), $shareTargets), 'share resolution must not request the final post or a non-whitelisted location');
    if ($shareTargets[$request->url()] === 'timeout') throw new Illuminate\Http\Client\ConnectionException('connection timed out');
    if ($shareTargets[$request->url()] === null) return $shareHttp->response('', 200);
    return $shareHttp->response('', 302, ['Location' => $shareTargets[$request->url()]]);
});
$shareService = new LinkPreviewService($shareHttp, $shareResolver);
$shareOptions = ['social' => true, 'generic' => false, 'images' => false, 'embeds' => ['facebook' => true]];
foreach (array_slice(array_keys($shareTargets), 0, 3) as $url) {
    $result = $shareService->preview($url, $shareOptions);
    assertLinkPreview($result['provider'] === 'facebook' && SocialEmbedPolicy::normalize($result['url']) !== null, 'share result must become a canonical allowed Facebook post');
}
foreach (array_slice(array_keys($shareTargets), 3) as $url) {
    try {
        $shareService->preview($url, $shareOptions);
        throw new RuntimeException('unresolved, external, private or looping share must fail');
    } catch (LinkPreviewException) { /* expected */ }
}
assertLinkPreview(count(array_diff($shareResolver->hosts, ['www.facebook.com', 'fb.watch'])) === 0, 'every share hop must stay on a fixed Facebook host');
foreach (['https://fb.watch.evil.test/ValidShort/', 'https://www.facebook.com/share/p/ValidPost/../../login.php', 'https://www.facebook.com:443/share/p/ValidPost/', 'https://www.facebook.com/share/p/%56alidPost/'] as $url) {
    assertLinkPreview(SocialEmbedPolicy::facebookRedirectUrl($url) === null, 'share input must not accept host/path disguises');
}
try {
    $shareService->preview('https://www.facebook.com/bangtan.official', $shareOptions);
    throw new RuntimeException('a profile must not be reported as an embedded post');
} catch (LinkPreviewException $exception) {
    assertLinkPreview($exception->getMessage() === 'preview_facebook_unsupported', 'unsupported Facebook URL must have actionable feedback');
}

// G7 admin requests and the plugin's 10/minute limit must not share one bucket.
$limits = new Illuminate\Cache\RateLimiter(new Illuminate\Cache\Repository(new Illuminate\Cache\ArrayStore()));
$throttle = new Illuminate\Routing\Middleware\ThrottleRequests($limits);
$request = Illuminate\Http\Request::create('/api/plugins/jwsoft-tiptap-editor/link-preview', 'POST');
$request->setUserResolver(fn () => new class { public function getAuthIdentifier() { return 'isolated-editor-qa'; } });
$next = fn () => new Symfony\Component\HttpFoundation\Response('ok');
for ($i = 0; $i < 12; $i++) $throttle->handle($request, $next, 60, 1);
try {
    $throttle->handle($request, $next, 10, 1);
    throw new RuntimeException('baseline shared bucket should reproduce the false 429');
} catch (Illuminate\Http\Exceptions\ThrottleRequestsException) { /* reproduced */ }
for ($i = 0; $i < 10; $i++) {
    assertLinkPreview($throttle->handle($request, $next, 10, 1, 'jwsoft-link-preview:')->getStatusCode() === 200, 'unrelated G7 calls must not consume preview quota');
}
try {
    $throttle->handle($request, $next, 10, 1, 'jwsoft-link-preview:');
    throw new RuntimeException('11th preview in the minute must still fail');
} catch (Illuminate\Http\Exceptions\ThrottleRequestsException) { /* original limit preserved */ }
assertLinkPreview(str_contains(file_get_contents($projectRoot.'/src/routes/api.php'), 'throttle:10,1,jwsoft-link-preview:'), 'runtime route must use the tested isolated bucket');

echo "[jwsoft] G7 link preview provider, Facebook shapes/share resolution, isolated throttle, settings, and SSRF gates passed\n";
