<?php

use Illuminate\Http\Request;
use Plugins\Jwsoft\TiptapEditor\Generated\EditorPolicy;
use Plugins\Jwsoft\TiptapEditor\Http\Middleware\CanonicalizeBoardPostHtml;
use Symfony\Component\HttpFoundation\Response;

$g7Root = $argv[1] ?? '';
$projectRoot = $argv[2] ?? '';
if (! is_file($g7Root.'/vendor/autoload.php') || ! is_file($projectRoot.'/vendor/autoload.php')) {
    throw new RuntimeException('G7 또는 plugin Composer autoload를 찾을 수 없습니다.');
}

require $g7Root.'/vendor/autoload.php';
require $projectRoot.'/vendor/autoload.php';

function assertG7Middleware(bool $condition, string $message): void
{
    if (! $condition) {
        throw new RuntimeException($message);
    }
}

$middleware = new CanonicalizeBoardPostHtml();
$next = static fn (Request $request): Response => new Response((string) $request->input('content'));

$request = Request::create('/api/modules/sirsoft-board/boards/free/posts', 'POST', [
    'content_mode' => 'html',
    'content' => '<p class="evil jw-align-center jw-indent-2" onclick="bad()">안녕</p><figure class="jw-image jw-image-align-center jw-image-size-50"><img src="/storage/editor/a.webp" alt="예시"><figcaption>캡션</figcaption></figure>',
    'jwsoft_editor_policy_ack' => EditorPolicy::SHA256,
]);
$response = $middleware->handle($request, $next);
assertG7Middleware($response->getStatusCode() === 200, 'acknowledged HTML write must pass');
assertG7Middleware($response->getContent() === '<p class="jw-align-center jw-indent-2">안녕</p><figure class="jw-image jw-image-align-center jw-image-size-50"><img alt="예시" src="/storage/editor/a.webp"><figcaption>캡션</figcaption></figure>', 'middleware must pass canonical HTML');

$unacknowledged = Request::create('/api/modules/sirsoft-board/boards/free/posts', 'POST', [
    'content_mode' => 'html',
    'content' => '<p onclick="bad()">안녕</p>',
]);
$response = $middleware->handle($unacknowledged, $next);
assertG7Middleware($response->getStatusCode() === 422, 'changed HTML without policy acknowledgement must fail');
assertG7Middleware(str_contains((string) $response->getContent(), 'canonical_confirmation_required'), 'missing acknowledgement failure code mismatch');

$ambiguousUpdate = Request::create('/api/modules/sirsoft-board/boards/free/posts/1', 'PUT', [
    'content' => '<p>수정</p>',
]);
$response = $middleware->handle($ambiguousUpdate, $next);
assertG7Middleware($response->getStatusCode() === 422, 'HTML mode ambiguity on update must fail closed');
assertG7Middleware(str_contains((string) $response->getContent(), 'content_mode_required'), 'missing content mode failure code mismatch');

echo "[jwsoft] G7 board write middleware test passed\n";
