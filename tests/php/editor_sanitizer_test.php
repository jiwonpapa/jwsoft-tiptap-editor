<?php

use Plugins\Jwsoft\TiptapEditor\Exceptions\PolicyViolationException;
use Plugins\Jwsoft\TiptapEditor\Policy\EditorPolicyLoader;
use Plugins\Jwsoft\TiptapEditor\Services\EditorSanitizer;

require dirname(__DIR__, 2).'/vendor/autoload.php';

function assertEditorPolicy(bool $condition, string $message): void
{
    if (! $condition) {
        throw new RuntimeException($message);
    }
}

$sanitizer = new EditorSanitizer();
$fixture = json_decode(
    file_get_contents(dirname(__DIR__, 2).'/harness/fixtures/security-corpus.json'),
    true,
    flags: JSON_THROW_ON_ERROR,
);

foreach ($fixture['cases'] as $case) {
    $result = $sanitizer->sanitize($case['input']);
    foreach ($case['mustKeep'] as $needle) {
        assertEditorPolicy(
            str_contains($result->canonicalHtml, $needle),
            $case['id'].' must keep '.$needle,
        );
    }
    foreach ($case['mustRemove'] as $needle) {
        assertEditorPolicy(
            ! str_contains(strtolower($result->canonicalHtml), strtolower($needle)),
            $case['id'].' must remove '.$needle,
        );
    }

    $secondPass = $sanitizer->sanitize($result->canonicalHtml);
    assertEditorPolicy(
        $secondPass->canonicalHtml === $result->canonicalHtml && ! $secondPass->changed,
        $case['id'].' canonical output must be idempotent',
    );
}

$link = $sanitizer->sanitize(
    '<p class="evil jw-align-center"><a href="https://example.com" target="_blank" rel="opener ugc">링크</a></p>',
);
assertEditorPolicy($link->canonicalHtml === '<p class="jw-align-center"><a href="https://example.com" rel="noopener noreferrer ugc" target="_blank">링크</a></p>', 'class token and _blank rel normalization failed');

$media = $sanitizer->sanitize(
    '<figure class="jw-media jw-media-16x9 jw-media-youtube"><a class="jw-media-source" href="https://www.youtube.com/watch?v=dQw4w9WgXcQ" target="_blank">YouTube</a></figure>',
);
assertEditorPolicy(str_contains($media->canonicalHtml, 'jw-media-youtube'), 'allowlisted media figure must survive');
assertEditorPolicy(! str_contains($media->canonicalHtml, '<iframe'), 'stored media must not contain iframe');

$spoofedMedia = $sanitizer->sanitize(
    '<figure class="jw-media jw-media-16x9 jw-media-youtube"><a class="jw-media-source" href="https://evil.example/video">가짜</a></figure>',
);
assertEditorPolicy(! str_contains($spoofedMedia->canonicalHtml, 'jw-media-youtube'), 'provider-mismatched media class must be removed');

$card = $sanitizer->sanitize(
    '<figure class="jw-card jw-card-instagram"><a class="jw-card-link" href="https://www.instagram.com/p/proof"><strong>Proof</strong><p>Safe description</p></a></figure>',
);
assertEditorPolicy(str_contains($card->canonicalHtml, 'jw-card-instagram'), 'allowlisted smart card must survive');
assertEditorPolicy(str_contains($card->canonicalHtml, 'rel="noopener noreferrer"'), 'smart card must force safe rel');
assertEditorPolicy(str_contains($card->canonicalHtml, 'target="_blank"'), 'smart card must force blank target');

$spoofedCard = $sanitizer->sanitize(
    '<figure class="jw-card jw-card-instagram"><a class="jw-card-link" href="https://evil.example/post"><strong>Spoof</strong></a></figure>',
);
assertEditorPolicy(! str_contains($spoofedCard->canonicalHtml, 'jw-card'), 'provider-mismatched smart card classes must be removed');

try {
    $sanitizer->sanitize(str_repeat('가', 400_000));
    throw new RuntimeException('oversized HTML must fail');
} catch (PolicyViolationException $exception) {
    assertEditorPolicy($exception->reasonCode === 'html_too_large', 'oversized HTML failure code mismatch');
}

try {
    $sanitizer->sanitize('<p>'.str_repeat('a', 500_001).'</p>');
    throw new RuntimeException('oversized text must fail');
} catch (PolicyViolationException $exception) {
    assertEditorPolicy($exception->reasonCode === 'text_too_large', 'oversized text failure code mismatch');
}

try {
    $sanitizer->sanitize('<table><tr>'.str_repeat('<td>x</td>', 10_001).'</tr></table>');
    throw new RuntimeException('oversized table must fail');
} catch (PolicyViolationException $exception) {
    assertEditorPolicy($exception->reasonCode === 'too_many_table_cells', 'table cell failure code mismatch');
}

$corruptPolicy = tempnam(sys_get_temp_dir(), 'jwsoft-policy-');
if (! is_string($corruptPolicy)) {
    throw new RuntimeException('temporary policy file creation failed');
}
file_put_contents($corruptPolicy, '{}');
try {
    (new EditorPolicyLoader($corruptPolicy))->load();
    throw new RuntimeException('corrupt policy must fail closed');
} catch (RuntimeException $exception) {
    assertEditorPolicy(str_contains($exception->getMessage(), 'checksum'), 'policy checksum failure message mismatch');
} finally {
    unlink($corruptPolicy);
}

echo "[jwsoft] PHP canonical sanitizer test passed\n";
