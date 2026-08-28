<?php

use App\Enums\ExtensionOwnerType;
use App\Models\Permission;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

function failLifecycleProbe(string $message): never
{
    throw new RuntimeException($message);
}

$g7Root = realpath($argv[1] ?? '');
$expectedVersion = $argv[2] ?? '';
$expectedJwsoftStatus = $argv[3] ?? '';
$expectedCkeditorStatus = $argv[4] ?? '';
$pageId = (int) ($argv[5] ?? 0);
$postId = (int) ($argv[6] ?? 0);
$productId = (int) ($argv[7] ?? 0);

if ($g7Root === false || ! is_file($g7Root.'/artisan')) {
    failLifecycleProbe('전용 G7 루트를 찾을 수 없습니다.');
}
if ($expectedVersion === '' || $expectedJwsoftStatus === '' || $expectedCkeditorStatus === '') {
    failLifecycleProbe('expected version and plugin statuses are required');
}
if (min($pageId, $postId, $productId) < 1) {
    failLifecycleProbe('page, post, and product record IDs are required');
}

require $g7Root.'/vendor/autoload.php';
$app = require $g7Root.'/bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();

$plugins = DB::table('plugins')
    ->whereIn('identifier', ['jwsoft-tiptap-editor', 'sirsoft-ckeditor5'])
    ->get()
    ->keyBy('identifier');
$jwsoft = $plugins->get('jwsoft-tiptap-editor');
$ckeditor = $plugins->get('sirsoft-ckeditor5');
if ($jwsoft === null || $ckeditor === null) {
    failLifecycleProbe('editor plugin records are missing');
}
if ((string) $jwsoft->version !== $expectedVersion || (string) $jwsoft->status !== $expectedJwsoftStatus) {
    failLifecycleProbe('JWSoft plugin version/status mismatch');
}
if ((string) $ckeditor->status !== $expectedCkeditorStatus) {
    failLifecycleProbe('CKEditor status mismatch');
}
if (! Schema::hasTable('jwsoft_tiptap_image_uploads')) {
    failLifecycleProbe('JWSoft image upload table is missing');
}
if (! Schema::hasTable('jwsoft_tiptap_media_uploads')
    || ! Schema::hasTable('jwsoft_tiptap_media_upload_sessions')) {
    failLifecycleProbe('JWSoft media upload tables are missing');
}

$records = [
    'page' => DB::table('pages')->where('id', $pageId)->value('content'),
    'boardPost' => DB::table('board_posts')->where('id', $postId)->value('content'),
    'product' => DB::table('ecommerce_products')->where('id', $productId)->value('description'),
];
foreach ($records as $kind => $content) {
    if (! is_string($content) || $content === '') {
        failLifecycleProbe($kind.' parity record is missing or empty');
    }
}

echo json_encode([
    'schemaVersion' => 1,
    'jwsoft' => ['version' => (string) $jwsoft->version, 'status' => (string) $jwsoft->status],
    'ckeditor' => ['version' => (string) $ckeditor->version, 'status' => (string) $ckeditor->status],
    'permissions' => Permission::byExtension(ExtensionOwnerType::Plugin, 'jwsoft-tiptap-editor')->count(),
    'imageUploadRows' => DB::table('jwsoft_tiptap_image_uploads')->count(),
    'mediaUploadRows' => DB::table('jwsoft_tiptap_media_uploads')->count(),
    'mediaSessionRows' => DB::table('jwsoft_tiptap_media_upload_sessions')->count(),
    'records' => array_map(
        static fn (string $content): array => [
            'bytes' => strlen($content),
            'sha256' => hash('sha256', $content),
        ],
        $records,
    ),
], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES).PHP_EOL;
