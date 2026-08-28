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
