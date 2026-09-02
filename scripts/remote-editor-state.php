<?php

/** Read-only state probe; plugin files and public G7 repositories only. */
$g7Root = realpath($argv[1] ?? '');
if ($g7Root === false || ! is_file($g7Root.'/artisan')) {
    throw new RuntimeException('G7 root missing.');
}
chdir($g7Root);
require $g7Root.'/vendor/autoload.php';
$app = require $g7Root.'/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
$repository = $app->make(App\Contracts\Repositories\PluginRepositoryInterface::class);
$jw = $repository->findByIdentifier('jwsoft-tiptap-editor');
$files = [];
$pluginRoot = $g7Root.'/plugins/jwsoft-tiptap-editor';
if (is_dir($pluginRoot)) {
    $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($pluginRoot, FilesystemIterator::SKIP_DOTS));
    foreach ($iterator as $file) {
        if ($file->isLink() || ! $file->isFile()) {
            continue;
        }
        $relative = substr($file->getPathname(), strlen($pluginRoot) + 1);
        if (preg_match('#^(?:vendor|node_modules|\.git)/#', $relative)) {
            continue;
        }
        $files[$relative] = hash_file('sha256', $file->getPathname());
    }
}
echo json_encode([
    'jwInstalled' => $jw !== null,
    'jwActive' => $repository->findActiveByIdentifier('jwsoft-tiptap-editor') !== null,
    'ckActive' => $repository->findActiveByIdentifier('sirsoft-ckeditor5') !== null,
    'jwVersion' => $jw?->version,
    'files' => $files,
], JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES).PHP_EOL;
