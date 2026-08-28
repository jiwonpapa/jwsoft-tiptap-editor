<?php

use Plugins\Jwsoft\TiptapEditor\Services\EditorSanitizer;

require dirname(__DIR__, 2).'/vendor/autoload.php';

function assertParityCorpus(bool $condition, string $message): void
{
    if (! $condition) {
        throw new RuntimeException($message);
    }
}

function htmlSemanticText(string $html): string
{
    $dom = new DOMDocument('1.0', 'UTF-8');
    $previous = libxml_use_internal_errors(true);
    $dom->loadHTML(
        '<?xml encoding="UTF-8"><div>'.$html.'</div>',
        LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD | LIBXML_NONET,
    );
    libxml_clear_errors();
    libxml_use_internal_errors($previous);

    return preg_replace('/\s+/u', '', $dom->textContent ?? '') ?? '';
}

$root = dirname(__DIR__, 2);
$sanitizer = new EditorSanitizer();
$security = json_decode(
    file_get_contents($root.'/harness/fixtures/security-corpus.json'),
    true,
    flags: JSON_THROW_ON_ERROR,
);
$legacy = json_decode(
    file_get_contents($root.'/harness/fixtures/legacy-html.json'),
    true,
    flags: JSON_THROW_ON_ERROR,
);
$securityResults = [];
$legacyResults = [];

foreach ($security['cases'] as $case) {
    $result = $sanitizer->sanitize($case['input']);
    foreach ($case['mustKeep'] as $needle) {
        assertParityCorpus(str_contains($result->canonicalHtml, $needle), $case['id'].' keep mismatch');
    }
    foreach ($case['mustRemove'] as $needle) {
        assertParityCorpus(
            ! str_contains(strtolower($result->canonicalHtml), strtolower($needle)),
            $case['id'].' removal mismatch',
        );
    }
    assertParityCorpus(
        $sanitizer->sanitize($result->canonicalHtml)->canonicalHtml === $result->canonicalHtml,
        $case['id'].' canonical output is not idempotent',
    );
    $securityResults[] = [
        'id' => $case['id'],
        'status' => 'pass',
        'canonicalSha256' => hash('sha256', $result->canonicalHtml),
    ];
}

foreach ($legacy['cases'] as $case) {
    $result = $sanitizer->sanitize($case['input']);
    $semanticText = htmlSemanticText($result->canonicalHtml);
    $expectedText = preg_replace('/\s+/u', '', $case['semanticText']) ?? '';
    assertParityCorpus($semanticText === $expectedText, $case['id'].' semantic text mismatch');
    foreach ($case['mustKeep'] ?? [] as $needle) {
        assertParityCorpus(str_contains($result->canonicalHtml, $needle), $case['id'].' keep mismatch');
    }
    foreach ($case['mustRemove'] ?? [] as $needle) {
        assertParityCorpus(
            ! str_contains(strtolower($result->canonicalHtml), strtolower($needle)),
            $case['id'].' removal mismatch',
        );
    }
    assertParityCorpus(
        $sanitizer->sanitize($result->canonicalHtml)->canonicalHtml === $result->canonicalHtml,
        $case['id'].' legacy round trip is not idempotent',
    );

    $changed = $result->canonicalHtml !== $case['input'];
    if (isset($case['migration'])) {
        assertParityCorpus($changed, $case['id'].' declared migration did not change output');
    }
    $legacyResults[] = [
        'id' => $case['id'],
        'status' => 'pass',
        'changed' => $changed,
        'migration' => $case['migration'] ?? null,
        'semanticTextSha256' => hash('sha256', $semanticText),
        'canonicalSha256' => hash('sha256', $result->canonicalHtml),
    ];
}

$output = $argv[1] ?? $root.'/test-results/parity/corpus.json';
if (! str_starts_with(realpath(dirname($output)) ?: dirname($output), $root)) {
    throw new RuntimeException('corpus evidence path must stay inside the project root');
}
if (! is_dir(dirname($output)) && ! mkdir(dirname($output), 0775, true) && ! is_dir(dirname($output))) {
    throw new RuntimeException('corpus evidence directory could not be created');
}
file_put_contents($output, json_encode([
    'schemaVersion' => 1,
    'status' => 'pass',
    'securityFixture' => 'harness/fixtures/security-corpus.json',
    'legacyFixture' => 'harness/fixtures/legacy-html.json',
    'securityCases' => $securityResults,
    'legacyCases' => $legacyResults,
], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE).PHP_EOL);

echo '[jwsoft] security '.count($securityResults).'개, legacy '.count($legacyResults)."개 corpus 통과\n";
