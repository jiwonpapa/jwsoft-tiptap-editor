<?php

use App\Enums\ExtensionOwnerType;
use App\Models\Permission;
use App\Services\PluginService;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

function assertZipInstall(bool $condition, string $message): void
{
    if (! $condition) {
        throw new RuntimeException($message);
    }
}

try {
    $g7Root = realpath($argv[1] ?? '');
    $artifact = realpath($argv[2] ?? '');
    $expectedVersion = $argv[3] ?? '';

    if ($g7Root === false || ! is_file($g7Root.'/artisan')) {
        throw new RuntimeException('전용 G7 루트를 찾을 수 없습니다.');
    }
    if ($artifact === false || ! is_file($artifact)) {
        throw new RuntimeException('설치 ZIP artifact를 찾을 수 없습니다.');
    }
    if ($expectedVersion === '') {
        throw new RuntimeException('예상 플러그인 버전이 필요합니다.');
    }

    require $g7Root.'/vendor/autoload.php';
    $app = require $g7Root.'/bootstrap/app.php';
    $app->make(Kernel::class)->bootstrap();

    $upload = new UploadedFile(
        $artifact,
        basename($artifact),
        'application/zip',
        UPLOAD_ERR_OK,
        true,
    );
    $result = $app->make(PluginService::class)->installFromZipFile($upload);

    assertZipInstall(($result['identifier'] ?? null) === 'jwsoft-tiptap-editor', 'ZIP install identifier mismatch');
    assertZipInstall(($result['version'] ?? null) === $expectedVersion, 'ZIP install version mismatch');
    assertZipInstall(Schema::hasTable('jwsoft_tiptap_image_uploads'), 'image upload migration did not run');

    $record = DB::table('plugins')->where('identifier', 'jwsoft-tiptap-editor')->first();
    assertZipInstall($record !== null, 'installed plugin record missing');
    assertZipInstall((string) $record->version === $expectedVersion, 'installed plugin record version mismatch');

    $permissionCount = Permission::byExtension(ExtensionOwnerType::Plugin, 'jwsoft-tiptap-editor')->count();
    assertZipInstall($permissionCount >= 2, 'upload read/delete permissions were not installed');

    echo "[jwsoft] G7 ZIP install, migration, record, and permission evidence passed\n";
} catch (Throwable $exception) {
    fwrite(STDERR, '[jwsoft] ERROR: '.$exception->getMessage().PHP_EOL);
    exit(1);
}
