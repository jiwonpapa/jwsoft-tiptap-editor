<?php

use App\Services\PluginService;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;

function failRemotePluginAction(string $message): never
{
    throw new RuntimeException($message);
}

$g7Root = realpath($argv[1] ?? '');
$action = $argv[2] ?? '';
$source = $argv[3] ?? '';
if ($g7Root === false || ! is_file($g7Root.'/artisan')) {
    failRemotePluginAction('전용 G7 루트를 찾을 수 없습니다.');
}

require_once __DIR__.'/require_dedicated_host.php';
requireDedicatedEditorHost($g7Root);
require $g7Root.'/vendor/autoload.php';
$app = require $g7Root.'/bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();

if ($action === 'install-github') {
    if (! str_starts_with($source, 'https://github.com/')) {
        failRemotePluginAction('공개 GitHub URL이 필요합니다.');
    }
    $app->make(PluginService::class)->installFromGithub($source);
} elseif ($action === 'install-zip') {
    $zip = realpath($source);
    if ($zip === false || ! is_file($zip)) {
        failRemotePluginAction('설치 ZIP을 찾을 수 없습니다.');
    }
    $app->make(PluginService::class)->installFromZipFile(
        new UploadedFile($zip, basename($zip), 'application/zip', null, true),
    );
} else {
    failRemotePluginAction('지원하지 않는 action입니다.');
}

$plugin = DB::table('plugins')->where('identifier', 'jwsoft-tiptap-editor')->first();
if ($plugin === null) {
    failRemotePluginAction('JWSoft plugin record가 없습니다.');
}
$pluginRoot = $g7Root.'/plugins/jwsoft-tiptap-editor';
$runtimeFiles = [
    'plugin.php',
    'plugin.json',
    'dist/js/plugin.iife.js',
    'vendor-bundle.zip',
    'vendor-bundle.json',
];
$hashes = [];
foreach ($runtimeFiles as $file) {
    $path = $pluginRoot.'/'.$file;
    if (! is_file($path)) {
        failRemotePluginAction('설치 runtime 파일 누락: '.$file);
    }
    $hashes[$file] = hash_file('sha256', $path);
}

echo json_encode([
    'schemaVersion' => 1,
    'action' => $action,
    'identifier' => (string) $plugin->identifier,
    'version' => (string) $plugin->version,
    'status' => (string) $plugin->status,
    'runtimeHashes' => $hashes,
], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES).PHP_EOL;
