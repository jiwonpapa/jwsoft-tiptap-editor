<?php

namespace Plugins\Jwsoft\TiptapEditor\Services;

use DOMDocument;
use DOMXPath;
use GuzzleHttp\Psr7\Uri;
use GuzzleHttp\Psr7\UriResolver;
use Illuminate\Http\Client\Factory;
use Illuminate\Http\Client\Response;
use Plugins\Jwsoft\TiptapEditor\Exceptions\LinkPreviewException;
use Plugins\Jwsoft\TiptapEditor\Services\Contracts\SafeUrlResolverInterface;

class LinkPreviewService
{
    private const MAX_BODY_BYTES = 524288;
    private const MAX_REDIRECTS = 3;

    public function __construct(
        private readonly Factory $http,
        private readonly SafeUrlResolverInterface $resolver,
    ) {}

    /**
     * @param array{social: bool, generic: bool, images: bool} $options
     * @return array{url: string, provider: string, provider_label: string, title: string, description: string, image_url: ?string}
     */
    public function preview(string $value, array $options): array
    {
        $embed = SocialEmbedPolicy::normalize($value);
        if ($embed && $options['social'] && ($options['embeds'][$embed['provider']] ?? false)) {
            $label = $this->providerLabel($embed['provider'], '');
            // This is a validated embed descriptor, not fetched/fabricated post metadata.
            return ['url' => $embed['url'], 'provider' => $embed['provider'], 'provider_label' => $label,
                'title' => $label.' post', 'description' => '', 'image_url' => null];
        }
        $url = $this->normalizeUrl($value);
        $provider = $this->providerFor($url);
        if (($provider === 'generic' && ! $options['generic'])
            || ($provider !== 'generic' && ! $options['social'])) {
            throw new LinkPreviewException('preview_provider_disabled');
        }

        [$finalUrl, $html] = $this->fetchHtml($url);
        $finalProvider = $this->providerFor($finalUrl);
        if (($finalProvider === 'generic' && ! $options['generic'])
            || ($finalProvider !== 'generic' && ! $options['social'])) {
            throw new LinkPreviewException('preview_redirect_provider_disabled');
        }
        $metadata = $this->metadata($html);
        $host = (string) parse_url($finalUrl, PHP_URL_HOST);
        $rawTitle = $this->cleanText($metadata['title'], 160);
        if ($rawTitle === '' || ($finalProvider !== 'generic'
            && in_array(strtolower($rawTitle), [strtolower($host), strtolower($this->providerLabel($finalProvider, $host))], true))) {
            throw new LinkPreviewException('preview_metadata_unavailable');
        }
        $title = $this->cleanText($metadata['title'] ?: $host, 160);
        $description = $this->cleanText($metadata['description'], 300);
        $imageUrl = $options['images']
            ? $this->safeImageUrl($metadata['image'], $host)
            : null;

        return [
            'url' => $finalUrl,
            'provider' => $finalProvider,
            'provider_label' => $this->providerLabel($finalProvider, $host),
            'title' => $title,
            'description' => $description,
            'image_url' => $imageUrl,
        ];
    }

    /** @return array{0: string, 1: string} */
    private function fetchHtml(string $initialUrl): array
    {
        $url = $initialUrl;
        for ($redirect = 0; $redirect <= self::MAX_REDIRECTS; $redirect++) {
            $parts = parse_url($url);
            $host = (string) ($parts['host'] ?? '');
            $address = $this->resolver->resolve($host);
            $resolveAddress = str_contains($address, ':') ? '['.$address.']' : $address;
            $response = $this->http
                ->withHeaders([
                    'Accept' => 'text/html,application/xhtml+xml;q=0.9',
                    'User-Agent' => 'JWSoft-Tiptap-LinkPreview/1.0',
                ])
                ->withOptions([
                    'allow_redirects' => false,
                    'stream' => true,
                    'curl' => [CURLOPT_RESOLVE => ["{$host}:443:{$resolveAddress}"]],
                ])
                ->connectTimeout(3)
                ->timeout(6)
                ->get($url);

            if (in_array($response->status(), [301, 302, 303, 307, 308], true)) {
                if ($redirect === self::MAX_REDIRECTS) {
                    throw new LinkPreviewException('preview_redirect_limit');
                }
                $location = $response->header('Location');
                if (! is_string($location) || $location === '') {
                    throw new LinkPreviewException('preview_redirect_invalid');
                }
                $url = $this->normalizeUrl((string) UriResolver::resolve(new Uri($url), new Uri($location)));
                continue;
            }
            if (! $response->successful()) {
                throw new LinkPreviewException('preview_http_failed');
            }
            $contentType = strtolower((string) $response->header('Content-Type'));
            if (! str_starts_with($contentType, 'text/html')
                && ! str_starts_with($contentType, 'application/xhtml+xml')) {
                throw new LinkPreviewException('preview_content_type_rejected');
            }

            return [$url, $this->readBody($response)];
        }

        throw new LinkPreviewException('preview_redirect_limit');
    }

    private function readBody(Response $response): string
    {
        $contentLength = $response->header('Content-Length');
        if (is_string($contentLength) && ctype_digit($contentLength) && (int) $contentLength > self::MAX_BODY_BYTES) {
            throw new LinkPreviewException('preview_body_too_large');
        }
        $stream = $response->toPsrResponse()->getBody();
        $body = '';
        while (! $stream->eof()) {
            $body .= $stream->read(8192);
            if (strlen($body) > self::MAX_BODY_BYTES) {
                throw new LinkPreviewException('preview_body_too_large');
            }
        }

        return $body;
    }

    /** @return array{title: string, description: string, image: string} */
    private function metadata(string $html): array
    {
        $dom = new DOMDocument('1.0', 'UTF-8');
        $previous = libxml_use_internal_errors(true);
        $loaded = $dom->loadHTML('<?xml encoding="UTF-8">'.$html, LIBXML_NONET | LIBXML_NOERROR | LIBXML_NOWARNING);
        libxml_clear_errors();
        libxml_use_internal_errors($previous);
        if (! $loaded) {
            throw new LinkPreviewException('preview_html_invalid');
        }
        $xpath = new DOMXPath($dom);

        return [
            'title' => $this->firstMeta($xpath, 'og:title') ?: trim((string) $xpath->evaluate('string(//title[1])')),
            'description' => $this->firstMeta($xpath, 'og:description') ?: $this->firstNamedMeta($xpath, 'description'),
            'image' => $this->firstMeta($xpath, 'og:image'),
        ];
    }

    private function firstMeta(DOMXPath $xpath, string $property): string
    {
        return trim((string) $xpath->evaluate('string(//meta[translate(@property, "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz")="'.$property.'"]/@content)'));
    }

    private function firstNamedMeta(DOMXPath $xpath, string $name): string
    {
        return trim((string) $xpath->evaluate('string(//meta[translate(@name, "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz")="'.$name.'"]/@content)'));
    }

    private function normalizeUrl(string $value): string
    {
        $value = trim($value);
        if ($value === '' || strlen($value) > 2048 || preg_match('/[\x00-\x20\x7f]/', $value)) {
            throw new LinkPreviewException('preview_url_rejected');
        }
        $parts = parse_url($value);
        if ($parts === false
            || strtolower((string) ($parts['scheme'] ?? '')) !== 'https'
            || ($parts['user'] ?? '') !== ''
            || ($parts['pass'] ?? '') !== ''
            || isset($parts['port'])
            || ! isset($parts['host'])) {
            throw new LinkPreviewException('preview_url_rejected');
        }
        $host = strtolower(rtrim((string) $parts['host'], '.'));
        if ($host === '' || preg_match('/^[a-z0-9.-]+$/', $host) !== 1) {
            throw new LinkPreviewException('preview_url_rejected');
        }
        $path = (string) ($parts['path'] ?? '/');
        $query = isset($parts['query']) ? '?'.$parts['query'] : '';

        return 'https://'.$host.($path === '' ? '/' : $path).$query;
    }

    private function providerFor(string $url): string
    {
        $host = strtolower((string) parse_url($url, PHP_URL_HOST));
        foreach ([
            'instagram' => ['instagram.com'],
            'x' => ['x.com', 'twitter.com'],
            'tiktok' => ['tiktok.com'],
            'facebook' => ['facebook.com', 'fb.watch'],
            'threads' => ['threads.net'],
        ] as $provider => $domains) {
            foreach ($domains as $domain) {
                if ($host === $domain || str_ends_with($host, '.'.$domain)) {
                    return $provider;
                }
            }
        }

        return 'generic';
    }

    private function providerLabel(string $provider, string $host): string
    {
        return match ($provider) {
            'instagram' => 'Instagram',
            'x' => 'X',
            'tiktok' => 'TikTok',
            'facebook' => 'Facebook',
            'threads' => 'Threads',
            default => $host,
        };
    }

    private function safeImageUrl(string $value, string $pageHost): ?string
    {
        try {
            $url = $this->normalizeUrl($value);
            $imageHost = (string) parse_url($url, PHP_URL_HOST);
            if ($imageHost !== $pageHost) {
                return null;
            }
            $this->resolver->resolve($imageHost);

            return $url;
        } catch (LinkPreviewException) {
            return null;
        }
    }

    private function cleanText(string $value, int $limit): string
    {
        $value = html_entity_decode(strip_tags($value), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $value = preg_replace('/\s+/u', ' ', trim($value)) ?? '';

        return function_exists('mb_substr') ? mb_substr($value, 0, $limit) : substr($value, 0, $limit);
    }
}
