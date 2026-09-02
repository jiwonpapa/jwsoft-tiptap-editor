<?php

use App\Services\PluginSettingsService;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

require_once __DIR__.'/require_dedicated_host.php';
$root = realpath($argv[1] ?? '');
$base = $argv[2] ?? '';
$credentials = realpath($argv[3] ?? '');
$image = realpath($argv[4] ?? '');
if (! $root || ! $credentials || ! $image || ! preg_match('~^http://127\.0\.0\.1:\d+$~', $base)) {
    throw new RuntimeException('Explicit disposable G7 and loopback HTTP endpoint required.');
}
requireDedicatedEditorHost($root);
require $root.'/vendor/autoload.php';
$app = require $root.'/bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
$db = DB::connection();
if (! $app->environment('local') || $db->getConfig('database') !== 'g7_testing'
    || (array) $db->getConfig('host') !== ['127.0.0.1']) {
    throw new RuntimeException('Only the dedicated local browser database is supported.');
}
$fixture = json_decode(file_get_contents($credentials), true, flags: JSON_THROW_ON_ERROR);
$user = App\Models\User::findOrFail($fixture['id']);
if ($user->email !== 'jw-editor-'.$fixture['runId'].'@example.invalid' || ! $user->is_super) {
    throw new RuntimeException('Only a fresh browser-run identity may execute this test.');
}
$service = $app->make(PluginSettingsService::class);
$identifier = 'jwsoft-tiptap-editor';
$before = $service->get($identifier);
$rows = $db->table('jwsoft_tiptap_image_uploads')->count();
$token = $user->createToken('jw-editor-image-off-test');
try {
    if (! $service->save($identifier, array_replace($before, ['imageUpload' => false]))) {
        throw new RuntimeException('Could not disable image upload in the fixture.');
    }
    $response = Http::withToken($token->plainTextToken)->acceptJson()->timeout(15)
        ->withoutRedirecting()->attach('upload', fopen($image, 'rb'), 'fixture.png')
        ->post($base.'/api/plugins/jwsoft-tiptap-editor/upload');
    if ($response->status() !== 403 || $db->table('jwsoft_tiptap_image_uploads')->count() !== $rows) {
        throw new RuntimeException('Image OFF must reject before creating an upload: HTTP '.$response->status());
    }
    echo json_encode(['status' => 'pass', 'blockedStatus' => $response->status(), 'rowsPreserved' => true]).PHP_EOL;
} finally {
    $token->accessToken->delete();
    if (! $service->save($identifier, $before) || $service->get($identifier) !== $before) {
        throw new RuntimeException('CRITICAL: fixture settings restoration failed.');
    }
}
