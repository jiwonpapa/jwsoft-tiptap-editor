<?php

namespace Plugins\Jwsoft\TiptapEditor\Services;

use DOMDocument;
use DOMElement;
use DOMNode;
use Plugins\Jwsoft\TiptapEditor\Exceptions\PolicyViolationException;
use Plugins\Jwsoft\TiptapEditor\Policy\EditorPolicyLoader;
use Plugins\Jwsoft\TiptapEditor\ValueObjects\SanitizationResult;
use RuntimeException;
use Symfony\Component\HtmlSanitizer\HtmlSanitizer;
use Symfony\Component\HtmlSanitizer\HtmlSanitizerAction;
use Symfony\Component\HtmlSanitizer\HtmlSanitizerConfig;

final class EditorSanitizer
{
    private const DROPPED_ELEMENTS = [
        'script', 'style', 'iframe', 'frame', 'frameset', 'object', 'embed',
        'applet', 'portal', 'form', 'input', 'textarea', 'select', 'option',
        'button', 'meta', 'link', 'base', 'svg', 'math', 'audio', 'video',
        'source', 'track', 'canvas', 'template', 'noscript',
    ];

    public function __construct(
        private readonly EditorPolicyLoader $policyLoader = new EditorPolicyLoader(),
    ) {}

    public function sanitize(string $html): SanitizationResult
    {
        $policy = $this->policyLoader->load();
        $maxHtmlBytes = (int) $policy['limits']['maxHtmlBytes'];

        if (strlen($html) > $maxHtmlBytes) {
            throw new PolicyViolationException(
                'html_too_large',
                'HTML 본문이 정책의 최대 바이트를 초과했습니다.',
            );
        }
        if ($html !== '' && preg_match('//u', $html) !== 1) {
            throw new PolicyViolationException(
                'invalid_utf8',
                'HTML 본문은 올바른 UTF-8이어야 합니다.',
            );
        }

        $sanitizer = new HtmlSanitizer($this->buildConfig($policy));
        $filtered = $sanitizer->sanitize($html);
        $canonical = $this->canonicalize($filtered, $policy);
        $this->enforceDocumentLimits($canonical, $policy);

        return new SanitizationResult($canonical, $canonical !== $html);
    }

    /** @param array<string, mixed> $policy */
    private function buildConfig(array $policy): HtmlSanitizerConfig
    {
        $config = (new HtmlSanitizerConfig())
            ->defaultAction(HtmlSanitizerAction::Block)
            ->withMaxInputLength((int) $policy['limits']['maxHtmlBytes'])
            ->allowLinkSchemes($policy['urls']['linkSchemes'])
            ->allowLinkHosts($policy['urls']['allowedLinkHosts'] ?: null)
            ->allowRelativeLinks((bool) $policy['urls']['allowRelativeLinks'])
            ->allowMediaSchemes($policy['media']['schemes'])
            ->allowMediaHosts($policy['media']['allowedHosts'] ?: null)
            ->allowRelativeMedias((bool) $policy['media']['allowRelative']);

        foreach (self::DROPPED_ELEMENTS as $element) {
            $config = $config->dropElement($element);
        }
        foreach ($policy['elements'] as $element => $definition) {
            $config = $config->allowElement($element, $definition['attributes']);
        }
        foreach ($policy['globalAttributes'] as $attribute) {
            $config = $config->allowAttribute($attribute, '*');
        }

        return $config;
    }

    /** @param array<string, mixed> $policy */
    private function canonicalize(string $html, array $policy): string
    {
        if ($html === '') {
            return '';
        }

        $dom = new DOMDocument('1.0', 'UTF-8');
        $previous = libxml_use_internal_errors(true);
        $loaded = $dom->loadHTML(
            '<?xml encoding="UTF-8"><div data-jwsoft-policy-root="1">'.$html.'</div>',
            LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD | LIBXML_NONET,
        );
        libxml_clear_errors();
        libxml_use_internal_errors($previous);

        if (! $loaded) {
            throw new RuntimeException('정제된 HTML을 canonical DOM으로 변환하지 못했습니다.');
        }

        $root = null;
        foreach ($dom->getElementsByTagName('div') as $candidate) {
            if ($candidate->getAttribute('data-jwsoft-policy-root') === '1') {
                $root = $candidate;
                break;
            }
        }
        if (! $root instanceof DOMElement) {
            throw new RuntimeException('Canonical HTML 루트 노드를 찾지 못했습니다.');
        }
        $root->removeAttribute('data-jwsoft-policy-root');

        $classTokens = [];
        foreach ($policy['classTokens'] as $tokens) {
            array_push($classTokens, ...$tokens);
        }
        $allowedClassTokens = array_fill_keys($classTokens, true);

        /** @var DOMElement $element */
        foreach ($root->getElementsByTagName('*') as $element) {
            $this->normalizeClass($element, $allowedClassTokens);
            $this->normalizeAttributes($element, $policy);
            if ($element->tagName === 'figure') {
                $this->normalizeImageFigure($element, $policy);
                $this->normalizeMediaFigure($element);
                $this->normalizeCardFigure($element);
            }
            $this->sortAttributes($element);
        }

        $output = '';
        foreach ($root->childNodes as $child) {
            $output .= $dom->saveHTML($child);
        }

        return $output;
    }

    /** @param array<string, true> $allowedClassTokens */
    private function normalizeClass(DOMElement $element, array $allowedClassTokens): void
    {
        if (! $element->hasAttribute('class')) {
            return;
        }

        $tokens = preg_split('/\s+/u', trim($element->getAttribute('class'))) ?: [];
        $tokens = array_values(array_unique(array_filter(
            $tokens,
            static fn (string $token): bool => isset($allowedClassTokens[$token]),
        )));
        sort($tokens);

        if ($tokens === []) {
            $element->removeAttribute('class');
        } else {
            $element->setAttribute('class', implode(' ', $tokens));
        }
    }

    /** @param array<string, mixed> $policy */
    private function normalizeAttributes(DOMElement $element, array $policy): void
    {
        foreach (['colspan', 'rowspan', 'width', 'height'] as $attribute) {
            if ($element->hasAttribute($attribute)) {
                if (! preg_match('/^[1-9][0-9]{0,5}$/', $element->getAttribute($attribute))) {
                    $element->removeAttribute($attribute);
                } else {
                    $element->setAttribute($attribute, (string) (int) $element->getAttribute($attribute));
                }
            }
        }
        if ($element->hasAttribute('start')) {
            if (! preg_match('/^-?[0-9]{1,6}$/', $element->getAttribute('start'))) {
                $element->removeAttribute('start');
            } else {
                $element->setAttribute('start', (string) (int) $element->getAttribute('start'));
            }
        }
        if ($element->hasAttribute('dir')) {
            $dir = strtolower($element->getAttribute('dir'));
            if (! in_array($dir, ['ltr', 'rtl', 'auto'], true)) {
                $element->removeAttribute('dir');
            } else {
                $element->setAttribute('dir', $dir);
            }
        }
        if ($element->hasAttribute('lang')) {
            $lang = strtolower($element->getAttribute('lang'));
            if (! preg_match('/^[a-z]{2,8}(?:-[a-z0-9]{1,8})*$/', $lang)) {
                $element->removeAttribute('lang');
            } else {
                $element->setAttribute('lang', $lang);
            }
        }
        if ($element->hasAttribute('loading')) {
            $loading = strtolower($element->getAttribute('loading'));
            if (! in_array($loading, ['lazy', 'eager'], true)) {
                $element->removeAttribute('loading');
            } else {
                $element->setAttribute('loading', $loading);
            }
        }
        if ($element->hasAttribute('scope')) {
            $scope = strtolower($element->getAttribute('scope'));
            if (! in_array($scope, ['row', 'col', 'rowgroup', 'colgroup'], true)) {
                $element->removeAttribute('scope');
            } else {
                $element->setAttribute('scope', $scope);
            }
        }

        if ($element->hasAttribute('href')
            && ! $this->isAllowedUrl($element->getAttribute('href'), $policy['urls'], false)) {
            $element->removeAttribute('href');
        }
        if ($element->hasAttribute('src')
            && ! $this->isAllowedUrl($element->getAttribute('src'), $policy['media'], true)) {
            $element->removeAttribute('src');
        }

        if ($element->tagName === 'a') {
            $this->normalizeLinkAttributes($element);
        }
    }

    private function normalizeLinkAttributes(DOMElement $element): void
    {
        if ($element->hasAttribute('target')) {
            $target = strtolower($element->getAttribute('target'));
            if (! in_array($target, ['_blank', '_self', '_parent', '_top'], true)) {
                $element->removeAttribute('target');
            } else {
                $element->setAttribute('target', $target);
            }
        }

        $allowedRel = ['noopener', 'noreferrer', 'nofollow', 'ugc', 'sponsored'];
        $rel = preg_split('/\s+/u', strtolower(trim($element->getAttribute('rel')))) ?: [];
        $rel = array_values(array_unique(array_intersect($rel, $allowedRel)));
        if ($element->getAttribute('target') === '_blank') {
            $rel = array_values(array_unique([...$rel, 'noopener', 'noreferrer']));
        }
        sort($rel);

        if ($rel === []) {
            $element->removeAttribute('rel');
        } else {
            $element->setAttribute('rel', implode(' ', $rel));
        }
    }

    /** @param array<string, mixed> $policy */
    private function normalizeImageFigure(DOMElement $element, array $policy): void
    {
        $classes = preg_split('/\s+/u', trim($element->getAttribute('class'))) ?: [];
        if (! in_array('jw-image', $classes, true)) {
            return;
        }

        $alignments = array_values(array_intersect($classes, [
            'jw-image-align-left', 'jw-image-align-center', 'jw-image-align-right',
        ]));
        $sizes = array_values(array_intersect($classes, [
            'jw-image-size-25', 'jw-image-size-50', 'jw-image-size-75', 'jw-image-size-100',
        ]));
        $children = [];
        foreach ($element->childNodes as $child) {
            if ($child instanceof DOMElement) {
                $children[] = $child;
            }
        }
        $image = $children[0] ?? null;
        $caption = $children[1] ?? null;
        $valid = count($alignments) === 1
            && count($sizes) === 1
            && count($children) <= 2
            && $image instanceof DOMElement
            && $image->tagName === 'img'
            && $this->isAllowedUrl($image->getAttribute('src'), $policy['media'], true)
            && ($caption === null || $caption->tagName === 'figcaption');
        if ($valid) {
            return;
        }

        $classes = array_values(array_filter(
            $classes,
            static fn (string $class): bool => ! str_starts_with($class, 'jw-image'),
        ));
        if ($classes === []) {
            $element->removeAttribute('class');
        } else {
            $element->setAttribute('class', implode(' ', $classes));
        }
    }

    private function normalizeMediaFigure(DOMElement $element): void
    {
        $classes = preg_split('/\s+/u', trim($element->getAttribute('class'))) ?: [];
        $providers = array_values(array_intersect(
            $classes,
            ['jw-media-youtube', 'jw-media-vimeo', 'jw-media-mp4'],
        ));
        if (! in_array('jw-media', $classes, true) || count($providers) !== 1) {
            return;
        }

        $source = $element->getElementsByTagName('a')->item(0);
        $provider = substr($providers[0], strlen('jw-media-'));
        $valid = $source instanceof DOMElement
            && in_array('jw-media-source', preg_split('/\s+/u', trim($source->getAttribute('class'))) ?: [], true)
            && $this->isAllowedMediaFigureUrl($source->getAttribute('href'), $provider);
        if ($valid) {
            return;
        }

        $classes = array_values(array_filter(
            $classes,
            static fn (string $class): bool => ! str_starts_with($class, 'jw-media'),
        ));
        if ($classes === []) {
            $element->removeAttribute('class');
        } else {
            $element->setAttribute('class', implode(' ', $classes));
        }
    }

    private function isAllowedMediaFigureUrl(string $url, string $provider): bool
    {
        $url = trim($url);
        if ($url === '' || str_starts_with($url, '//')) {
            return false;
        }
        $parts = parse_url($url);
        if ($parts === false) {
            return false;
        }
        $relative = str_starts_with($url, '/');
        if (! $relative && strtolower((string) ($parts['scheme'] ?? '')) !== 'https') {
            return false;
        }
        if (($parts['user'] ?? '') !== '' || ($parts['pass'] ?? '') !== '') {
            return false;
        }

        $host = strtolower((string) ($parts['host'] ?? ''));
        $host = preg_replace('/^www\./', '', $host) ?? $host;
        $path = (string) ($parts['path'] ?? '');
        if ($provider === 'youtube') {
            $id = '';
            if ($host === 'youtu.be') {
                $id = explode('/', trim($path, '/'))[0] ?? '';
            } elseif (in_array($host, ['youtube.com', 'm.youtube.com', 'music.youtube.com'], true)) {
                $segments = explode('/', trim($path, '/'));
                if (($segments[0] ?? '') === 'watch') {
                    parse_str((string) ($parts['query'] ?? ''), $query);
                    $id = (string) ($query['v'] ?? '');
                } elseif (in_array($segments[0] ?? '', ['embed', 'shorts', 'live'], true)) {
                    $id = $segments[1] ?? '';
                }
            }

            return preg_match('/^[A-Za-z0-9_-]{11}$/', $id) === 1;
        }
        if ($provider === 'vimeo') {
            if (! in_array($host, ['vimeo.com', 'player.vimeo.com'], true)) {
                return false;
            }
            $segments = explode('/', trim($path, '/'));
            $id = $host === 'player.vimeo.com' && ($segments[0] ?? '') === 'video'
                ? ($segments[1] ?? '')
                : ($segments[0] ?? '');

            return preg_match('/^[0-9]{5,12}$/', $id) === 1;
        }
        if ($provider === 'mp4') {
            return str_ends_with(strtolower($path), '.mp4')
                || preg_match('#^/api/plugins/jwsoft-tiptap-editor/media/[a-f0-9]{12}$#', $path) === 1;
        }

        return false;
    }

    private function normalizeCardFigure(DOMElement $element): void
    {
        $classes = preg_split('/\s+/u', trim($element->getAttribute('class'))) ?: [];
        $providerClasses = [
            'jw-card-generic', 'jw-card-instagram', 'jw-card-x',
            'jw-card-tiktok', 'jw-card-facebook', 'jw-card-threads',
        ];
        $providers = array_values(array_intersect($classes, $providerClasses));
        if (! in_array('jw-card', $classes, true) || count($providers) !== 1) {
            return;
        }
        $link = $element->getElementsByTagName('a')->item(0);
        $provider = substr($providers[0], strlen('jw-card-'));
        $strong = $element->getElementsByTagName('strong')->item(0);
        $valid = $link instanceof DOMElement
            && $strong instanceof DOMElement
            && trim($strong->textContent) !== ''
            && in_array('jw-card-link', preg_split('/\s+/u', trim($link->getAttribute('class'))) ?: [], true)
            && $this->isAllowedCardUrl($link->getAttribute('href'), $provider);

        $image = $element->getElementsByTagName('img')->item(0);
        if ($valid && $image instanceof DOMElement) {
            $linkHost = strtolower((string) parse_url($link->getAttribute('href'), PHP_URL_HOST));
            $imageHost = strtolower((string) parse_url($image->getAttribute('src'), PHP_URL_HOST));
            $valid = in_array('jw-card-image', preg_split('/\s+/u', trim($image->getAttribute('class'))) ?: [], true)
                && $imageHost !== ''
                && $imageHost === $linkHost
                && strtolower((string) parse_url($image->getAttribute('src'), PHP_URL_SCHEME)) === 'https';
        }

        if ($valid) {
            $link->setAttribute('target', '_blank');
            $link->setAttribute('rel', 'noopener noreferrer');

            return;
        }

        $nodes = [$element];
        foreach ($element->getElementsByTagName('*') as $descendant) {
            $nodes[] = $descendant;
        }
        foreach ($nodes as $node) {
            if (! $node instanceof DOMElement || ! $node->hasAttribute('class')) {
                continue;
            }
            $nodeClasses = preg_split('/\s+/u', trim($node->getAttribute('class'))) ?: [];
            $nodeClasses = array_values(array_filter(
                $nodeClasses,
                static fn (string $class): bool => ! str_starts_with($class, 'jw-card'),
            ));
            if ($nodeClasses === []) {
                $node->removeAttribute('class');
            } else {
                $node->setAttribute('class', implode(' ', $nodeClasses));
            }
        }
    }

    private function isAllowedCardUrl(string $url, string $provider): bool
    {
        $url = trim($url);
        $parts = parse_url($url);
        if ($parts === false
            || strtolower((string) ($parts['scheme'] ?? '')) !== 'https'
            || ($parts['user'] ?? '') !== ''
            || ($parts['pass'] ?? '') !== ''
            || isset($parts['port'])
            || ! isset($parts['host'])) {
            return false;
        }
        $host = strtolower(rtrim((string) $parts['host'], '.'));
        $domains = match ($provider) {
            'instagram' => ['instagram.com'],
            'x' => ['x.com', 'twitter.com'],
            'tiktok' => ['tiktok.com'],
            'facebook' => ['facebook.com', 'fb.watch'],
            'threads' => ['threads.net'],
            'generic' => [],
            default => null,
        };
        if ($domains === null) {
            return false;
        }
        if ($provider === 'generic') {
            return $host !== '';
        }
        foreach ($domains as $domain) {
            if ($host === $domain || str_ends_with($host, '.'.$domain)) {
                return true;
            }
        }

        return false;
    }

    private function sortAttributes(DOMElement $element): void
    {
        $attributes = [];
        foreach ($element->attributes as $attribute) {
            $attributes[$attribute->name] = $attribute->value;
        }
        ksort($attributes);
        foreach (array_keys($attributes) as $name) {
            $element->removeAttribute($name);
        }
        foreach ($attributes as $name => $value) {
            $element->setAttribute($name, $value);
        }
    }

    /** @param array<string, mixed> $rules */
    private function isAllowedUrl(string $url, array $rules, bool $media): bool
    {
        $url = trim($url);
        if ($url === ''
            || preg_match('/[\x00-\x20\x7f\x{202a}-\x{202e}\x{2066}-\x{2069}]/u', $url)) {
            return false;
        }
        if (str_starts_with($url, '//')) {
            return false;
        }

        $scheme = parse_url($url, PHP_URL_SCHEME);
        if (! is_string($scheme) || $scheme === '') {
            return (bool) ($media ? $rules['allowRelative'] : $rules['allowRelativeLinks']);
        }

        $schemes = $media ? $rules['schemes'] : $rules['linkSchemes'];
        if (! in_array(strtolower($scheme), $schemes, true)) {
            return false;
        }

        if (in_array(strtolower($scheme), ['mailto', 'tel'], true)) {
            return ! $media;
        }

        $host = parse_url($url, PHP_URL_HOST);
        if (! is_string($host) || $host === '' || parse_url($url, PHP_URL_USER) !== null) {
            return false;
        }
        $allowedHosts = $media ? $rules['allowedHosts'] : $rules['allowedLinkHosts'];

        return $allowedHosts === [] || in_array(strtolower($host), array_map('strtolower', $allowedHosts), true);
    }

    /** @param array<string, mixed> $policy */
    private function enforceDocumentLimits(string $html, array $policy): void
    {
        if (strlen($html) > (int) $policy['limits']['maxHtmlBytes']) {
            throw new PolicyViolationException('canonical_html_too_large', '정제된 HTML이 최대 바이트를 초과했습니다.');
        }

        $dom = new DOMDocument('1.0', 'UTF-8');
        $previous = libxml_use_internal_errors(true);
        $dom->loadHTML('<?xml encoding="UTF-8"><div>'.$html.'</div>', LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD | LIBXML_NONET);
        libxml_clear_errors();
        libxml_use_internal_errors($previous);

        $text = $dom->textContent ?? '';
        $textLength = function_exists('mb_strlen') ? mb_strlen($text) : strlen($text);
        if ($textLength > (int) $policy['limits']['maxTextCharacters']) {
            throw new PolicyViolationException('text_too_large', '본문 텍스트가 최대 글자 수를 초과했습니다.');
        }

        $cells = 0;
        foreach (['td', 'th'] as $tag) {
            /** @var DOMElement $cell */
            foreach ($dom->getElementsByTagName($tag) as $cell) {
                $colspan = max(1, (int) ($cell->getAttribute('colspan') ?: 1));
                $rowspan = max(1, (int) ($cell->getAttribute('rowspan') ?: 1));
                $cells += $colspan * $rowspan;
            }
        }
        if ($cells > (int) $policy['limits']['maxTableCells']) {
            throw new PolicyViolationException('too_many_table_cells', '표 셀 수가 정책 상한을 초과했습니다.');
        }
    }
}
