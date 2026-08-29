<?php

use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

function failContentProbe(string $message): never
{
    throw new RuntimeException($message);
}

$g7Root = realpath($argv[1] ?? '');
$pageId = (int) ($argv[2] ?? 0);
$postId = (int) ($argv[3] ?? 0);
$productId = (int) ($argv[4] ?? 0);
if ($g7Root === false || ! is_file($g7Root.'/artisan')) {
    failContentProbe('전용 G7 루트를 찾을 수 없습니다.');
}
if (min($pageId, $postId, $productId) < 1) {
    failContentProbe('page, post, product ID가 필요합니다.');
}

require $g7Root.'/vendor/autoload.php';
$app = require $g7Root.'/bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();

$records = [
    'page' => DB::table('pages')->where('id', $pageId)->value('content'),
    'boardPost' => DB::table('board_posts')->where('id', $postId)->value('content'),
    'product' => DB::table('ecommerce_products')->where('id', $productId)->value('description'),
];
foreach ($records as $kind => $content) {
    if (! is_string($content) || $content === '') {
        failContentProbe($kind.' 검증 콘텐츠가 없습니다.');
    }
}
$tables = [
    'jwsoft_tiptap_image_uploads',
    'jwsoft_tiptap_media_uploads',
    'jwsoft_tiptap_media_upload_sessions',
];
foreach ($tables as $table) {
    if (! Schema::hasTable($table)) {
        failContentProbe('플러그인 데이터 테이블 누락: '.$table);
    }
}

echo json_encode([
    'schemaVersion' => 1,
    'pluginInstalled' => DB::table('plugins')->where('identifier', 'jwsoft-tiptap-editor')->exists(),
    'tables' => array_fill_keys($tables, true),
    'records' => array_map(
        static fn (string $content): array => [
            'bytes' => strlen($content),
            'sha256' => hash('sha256', $content),
        ],
        $records,
    ),
], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES).PHP_EOL;
