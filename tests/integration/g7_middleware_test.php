<?php

use Illuminate\Container\Container;
use Illuminate\Events\Dispatcher;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Router;
use Illuminate\Support\Facades\Facade;
use Illuminate\Support\Facades\Route;
use Plugins\Jwsoft\TiptapEditor\Generated\EditorPolicy;
use Plugins\Jwsoft\TiptapEditor\Http\Middleware\CanonicalizeBoardPostHtml;
use Plugins\Jwsoft\TiptapEditor\Http\Middleware\CanonicalizeEditorHtml;
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

/** @return array<string, mixed> */
function g7MiddlewarePayload(Response $response): array
{
    $payload = json_decode((string) $response->getContent(), true);
    if (! is_array($payload)) {
        throw new RuntimeException('middleware test response must be JSON');
    }

    return $payload;
}

$routeTargets = [
    'api.modules.sirsoft-board.boards.posts.store',
    'api.modules.sirsoft-board.boards.posts.update',
    'api.modules.sirsoft-board.admin.board.posts.store',
    'api.modules.sirsoft-board.admin.board.posts.update',
    'api.modules.sirsoft-ecommerce.admin.products.store',
    'api.modules.sirsoft-ecommerce.admin.products.update',
    'api.modules.sirsoft-ecommerce.admin.products.update-by-code',
    'api.modules.sirsoft-ecommerce.admin.product-common-infos.store',
    'api.modules.sirsoft-ecommerce.admin.product-common-infos.update',
    'api.modules.sirsoft-page.admin.pages.store',
    'api.modules.sirsoft-page.admin.pages.update',
];

$container = new Container();
$router = new Router(new Dispatcher($container), $container);
$container->instance('router', $router);
Facade::setFacadeApplication($container);
foreach (['sirsoft-board', 'sirsoft-ecommerce', 'sirsoft-page'] as $module) {
    $routeFile = $g7Root."/modules/_bundled/{$module}/src/routes/api.php";
    assertG7Middleware(is_file($routeFile), "G7 bundled route file missing: {$module}");
    Route::prefix("api/modules/{$module}")
        ->name("api.modules.{$module}.")
        ->middleware('api')
        ->group($routeFile);
}
$router->getRoutes()->refreshNameLookups();
foreach ($routeTargets as $routeTarget) {
    assertG7Middleware(
        $router->getRoutes()->getByName($routeTarget) !== null,
        "declared editor middleware target is not a G7 7.0.9 route: {$routeTarget}",
    );
}

assertG7Middleware(
    is_subclass_of(CanonicalizeBoardPostHtml::class, CanonicalizeEditorHtml::class),
    'legacy board middleware class must remain compatible',
);

$middleware = new CanonicalizeEditorHtml();
$next = static fn (Request $request): JsonResponse => new JsonResponse([
    'content' => $request->input('content'),
    'description' => $request->input('description'),
]);

$boardRequest = Request::create('/api/modules/sirsoft-board/boards/free/posts', 'POST', [
    'content_mode' => 'html',
    'content' => '<p class="evil jw-align-center jw-indent-2" onclick="bad()">안녕</p><figure class="jw-image jw-image-align-center jw-image-size-50"><img src="/storage/editor/a.webp" alt="예시"><figcaption>캡션</figcaption></figure>',
    'jwsoft_editor_policy_ack' => EditorPolicy::SHA256,
]);
$response = $middleware->handle($boardRequest, $next);
$payload = g7MiddlewarePayload($response);
assertG7Middleware($response->getStatusCode() === 200, 'acknowledged board HTML write must pass');
assertG7Middleware(
    $payload['content'] === '<p class="jw-align-center jw-indent-2">안녕</p><figure class="jw-image jw-image-align-center jw-image-size-50"><img alt="예시" src="/storage/editor/a.webp"><figcaption>캡션</figcaption></figure>',
    'board middleware must pass canonical HTML',
);

$unacknowledged = Request::create('/api/modules/sirsoft-board/boards/free/posts', 'POST', [
    'content_mode' => 'html',
    'content' => '<p onclick="bad()">안녕</p>',
]);
$response = $middleware->handle($unacknowledged, $next);
assertG7Middleware($response->getStatusCode() === 422, 'changed HTML without policy acknowledgement must fail');
assertG7Middleware(str_contains((string) $response->getContent(), 'canonical_confirmation_required'), 'missing acknowledgement failure code mismatch');

$ambiguousBoardUpdate = Request::create('/api/modules/sirsoft-board/boards/free/posts/1', 'PUT', [
    'content' => '<p>수정</p>',
]);
$response = $middleware->handle($ambiguousBoardUpdate, $next);
assertG7Middleware($response->getStatusCode() === 422, 'board HTML mode ambiguity on update must fail closed');
assertG7Middleware(str_contains((string) $response->getContent(), 'content_mode_required'), 'missing board content mode failure code mismatch');

$productRequest = Request::create('/api/modules/sirsoft-ecommerce/admin/products', 'POST', [
    'description_mode' => 'html',
    'description' => [
        'ko' => '<p class="evil jw-align-center" style="color:red" onclick="bad()">상품 설명</p>',
        'en' => '<p onmouseover="bad()">Product description</p>',
        'ja' => null,
    ],
    'jwsoft_editor_policy_ack' => EditorPolicy::SHA256,
]);
$response = $middleware->handle($productRequest, $next);
$payload = g7MiddlewarePayload($response);
assertG7Middleware($response->getStatusCode() === 200, 'multilingual product HTML write must pass');
assertG7Middleware(
    $payload['description'] === [
        'ko' => '<p class="jw-align-center">상품 설명</p>',
        'en' => '<p>Product description</p>',
        'ja' => null,
    ],
    'product locale map must be canonicalized without deleting null locales',
);

$ambiguousProductUpdate = Request::create('/api/modules/sirsoft-ecommerce/admin/products/1', 'PUT', [
    'description' => ['ko' => '<p>수정</p>'],
]);
$response = $middleware->handle($ambiguousProductUpdate, $next);
assertG7Middleware($response->getStatusCode() === 422, 'product HTML mode ambiguity on update must fail closed');
assertG7Middleware(str_contains((string) $response->getContent(), 'description_mode_required'), 'missing product description mode failure code mismatch');

$ambiguousPageCreate = Request::create('/api/modules/sirsoft-page/admin/pages', 'POST', [
    'content' => ['ko' => '<img src=x onerror=bad()>'],
]);
$response = $middleware->handle($ambiguousPageCreate, $next);
assertG7Middleware($response->getStatusCode() === 422, 'page create without mode must not inherit the G7 html default');
assertG7Middleware(str_contains((string) $response->getContent(), 'content_mode_required'), 'missing page content mode failure code mismatch');

$invalidProductMap = Request::create('/api/modules/sirsoft-ecommerce/admin/products', 'POST', [
    'description_mode' => 'html',
    'description' => ['ko' => ['nested' => '<p>우회</p>']],
]);
$response = $middleware->handle($invalidProductMap, $next);
assertG7Middleware($response->getStatusCode() === 422, 'nested product HTML map must fail closed');
assertG7Middleware(str_contains((string) $response->getContent(), 'invalid_html_description'), 'invalid product map failure code mismatch');

$commonInfoRequest = Request::create('/api/modules/sirsoft-ecommerce/admin/product-common-infos', 'POST', [
    'content_mode' => 'html',
    'content' => ['ko' => '<p style="color:red">공통정보</p>'],
    'jwsoft_editor_policy_ack' => EditorPolicy::SHA256,
]);
$response = $middleware->handle($commonInfoRequest, $next);
$payload = g7MiddlewarePayload($response);
assertG7Middleware(
    $response->getStatusCode() === 200 && $payload['content']['ko'] === '<p>공통정보</p>',
    'product common info locale map must be canonicalized',
);

$clearCommonInfoRequest = Request::create('/api/modules/sirsoft-ecommerce/admin/product-common-infos/1', 'PUT', [
    'content_mode' => 'html',
    'content' => null,
]);
$response = $middleware->handle($clearCommonInfoRequest, $next);
$payload = g7MiddlewarePayload($response);
assertG7Middleware(
    $response->getStatusCode() === 200 && $payload['content'] === null,
    'nullable G7 editor fields must remain clearable',
);

$pageRequest = Request::create('/api/modules/sirsoft-page/admin/pages', 'POST', [
    'content_mode' => 'html',
    'content' => [
        'ko' => '<p><img src="/storage/editor/page.webp" onerror="bad()" alt="페이지">페이지</p>',
        'en' => '<p>Page</p>',
    ],
    'jwsoft_editor_policy_ack' => EditorPolicy::SHA256,
]);
$response = $middleware->handle($pageRequest, $next);
$payload = g7MiddlewarePayload($response);
assertG7Middleware($response->getStatusCode() === 200, 'multilingual page HTML write must pass');
assertG7Middleware(
    ! str_contains(json_encode($payload['content'], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR), 'onerror'),
    'page locale map must remove event attributes',
);

$textRequest = Request::create('/api/modules/sirsoft-page/admin/pages/1', 'PUT', [
    'content_mode' => 'text',
    'content' => ['ko' => '<script>텍스트로 보존</script>'],
]);
$response = $middleware->handle($textRequest, $next);
$payload = g7MiddlewarePayload($response);
assertG7Middleware(
    $response->getStatusCode() === 200 && $payload['content']['ko'] === '<script>텍스트로 보존</script>',
    'text mode content must remain owned by the G7 text renderer',
);

echo "[jwsoft] G7 editor write route and middleware test passed\n";
