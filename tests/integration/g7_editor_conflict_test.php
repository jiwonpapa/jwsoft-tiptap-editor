<?php

use App\Services\PluginService;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

$root = realpath($argv[1] ?? '') ?: throw new RuntimeException('Host missing');
require_once __DIR__.'/require_dedicated_host.php';
requireDedicatedEditorHost($root);
require $root.'/vendor/autoload.php';
$app = require $root.'/bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
if (! $app->environment('local') || DB::connection()->getDatabaseName() !== 'g7_testing') {
    throw new RuntimeException('Disposable database required.');
}
$states = static fn () => DB::table('plugins')
    ->whereIn('identifier', ['jwsoft-tiptap-editor', 'sirsoft-ckeditor5'])
    ->pluck('status', 'identifier')->all();
$before = $states();
if (($before['jwsoft-tiptap-editor'] ?? '') !== 'active'
    || ($before['sirsoft-ckeditor5'] ?? '') !== 'inactive') {
    throw new RuntimeException('Initial editor state mismatch.');
}
$blocked = false;
try {
    $result = $app->make(PluginService::class)->activatePlugin('sirsoft-ckeditor5');
    $blocked = ($result['success'] ?? true) === false;
} catch (ValidationException) {
    $blocked = true;
} catch (RuntimeException $error) {
    if (! str_contains($error->getMessage(), '에디터는 하나만 활성화할 수 있습니다.')) {
        throw $error;
    }
    $blocked = true;
}
if (! $blocked || $states() !== $before) {
    throw new RuntimeException('Concurrent editor activation was not safely refused.');
}
echo json_encode(['blocked' => true, 'statePreserved' => true], JSON_THROW_ON_ERROR).PHP_EOL;
