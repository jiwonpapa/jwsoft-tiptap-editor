<?php

// Actual authenticated HTTP, not a mocked controller. Explicit disposable opt-in only.
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

$root = realpath($argv[1] ?? '');
$base = rtrim($argv[2] ?? '', '/');
$email = $argv[3] ?? '';
$postId = (int) ($argv[4] ?? 0);
if (getenv('JWSOFT_DISPOSABLE_G7_TEST') !== '1' || ! $root
    || ! is_file($root.'/artisan') || ! preg_match('~^http://127\.0\.0\.1:\d+$~', $base)) {
    throw new RuntimeException('Explicit disposable G7 root and loopback HTTP endpoint required.');
}
require $root.'/vendor/autoload.php';
$app = require $root.'/bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
$db = DB::connection();
if (! $app->environment('local') || $db->getConfig('database') !== 'g7_testing'
    || (array) $db->getConfig('host') !== ['127.0.0.1']) {
    throw new RuntimeException('Disposable local g7_testing database required.');
}
$user = App\Models\User::where('email', $email)->firstOrFail();
$post = $db->table('board_posts')->where('id', $postId)->first();
if ($user->name !== 'Release QA' || ! $post || (int) $post->user_id !== (int) $user->id
    || ! str_starts_with($post->title, 'JWSoft')) {
    throw new RuntimeException('Only a dedicated Release QA account and its QA post may be tested.');
}
$snapshot = static fn (): string => hash('sha256', json_encode($db->table('board_posts')->orderBy('id')->get(['id', 'content'])));
$before = $snapshot();
$token = $user->createToken('jwsoft-empty-body-http-test');
$checks = [];
try {
    $http = Http::withToken($token->plainTextToken)->acceptJson()->timeout(15)->withoutRedirecting();
    foreach (['boards/free/posts', 'admin/board/free/posts'] as $route) {
        foreach (['POST', 'PUT', 'REPLY'] as $method) {
            foreach (['<p></p>', '<p> &nbsp;&#8203;&#65279; </p>', '<table><tbody><tr><td><p></p></td></tr></tbody></table>'] as $html) {
                $body = ['title' => 'JWSoft empty body HTTP regression', 'content' => $html,
                    'content_mode' => 'html', 'jwsoft_editor_policy_ack' => Plugins\Jwsoft\TiptapEditor\Generated\EditorPolicy::SHA256];
                if ($method === 'REPLY') $body['parent_id'] = $postId;
                $response = $http->send($method === 'PUT' ? 'PUT' : 'POST',
                    $base.'/api/modules/sirsoft-board/'.$route.($method === 'PUT' ? '/'.$postId : ''), ['json' => $body]);
                if ($response->status() !== 422 || ! $response->json('errors.content')) {
                    throw new RuntimeException('Expected actual content validation rejection: '.$route.' '.$method.' HTTP '.$response->status());
                }
                $checks[] = ['surface' => str_starts_with($route, 'admin') ? 'admin' : 'public', 'action' => $method, 'status' => 422];
            }
        }
    }
    if ($snapshot() !== $before) throw new RuntimeException('Post content changed during rejected writes.');
    echo json_encode(['passed' => count($checks), 'checks' => $checks, 'postContentUnchanged' => true], JSON_PRETTY_PRINT).PHP_EOL;
} finally {
    $token->accessToken->delete();
}
