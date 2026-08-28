<?php

use App\Contracts\Extension\StorageInterface;
use App\Extension\HookManager;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Events\Dispatcher;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Facade;
use App\Rules\ValidLayoutStructure;
use App\Rules\WhitelistedEndpoint;
use Plugins\Jwsoft\TiptapEditor\Models\JwsoftTiptapImageUpload;
use Plugins\Jwsoft\TiptapEditor\Repositories\Contracts\ImageUploadRepositoryInterface;
use Plugins\Jwsoft\TiptapEditor\Services\ImageCleanupService;
use Plugins\Jwsoft\TiptapEditor\Services\ImageReferenceScanService;
use Plugins\Jwsoft\TiptapEditor\Services\ImageServeService;
use Plugins\Jwsoft\TiptapEditor\Services\ImageUploadService;
use Plugins\Jwsoft\TiptapEditor\Support\ImageHookContract;
use Symfony\Component\HttpFoundation\StreamedResponse;

$g7Root = $argv[1] ?? '';
$projectRoot = $argv[2] ?? '';
require $g7Root.'/vendor/autoload.php';
require $projectRoot.'/vendor/autoload.php';

$container = new Illuminate\Container\Container();
$container->instance('events', new Dispatcher($container));
$container->instance('log', new class {
    public function warning(string $message, array $context = []): void {}
    public function error(string $message, array $context = []): void {}
});
Facade::setFacadeApplication($container);

function assertImageSubsystem(bool $condition, string $message): void
{
    if (! $condition) {
        throw new RuntimeException($message);
    }
}

$layout = json_decode(file_get_contents($projectRoot.'/resources/layouts/admin/tiptap_uploads.json'), true, flags: JSON_THROW_ON_ERROR);
$layoutErrors = [];
(new ValidLayoutStructure())->validate('layout', $layout, function (string $message) use (&$layoutErrors): void {
    $layoutErrors[] = $message;
});
(new WhitelistedEndpoint())->validate('layout', $layout, function (string $message) use (&$layoutErrors): void {
    $layoutErrors[] = $message;
});
assertImageSubsystem($layoutErrors === [], 'admin upload layout failed G7 structure or endpoint validation');

final class TestImageStorage implements StorageInterface
{
    /** @var array<string, string> */
    public array $files = [];
    public bool $deleteSucceeds = true;

    public function put(string $category, string $path, mixed $content): bool
    {
        $this->files[$category.'/'.$path] = (string) $content;

        return true;
    }

    public function get(string $category, string $path): ?string
    {
        return $this->files[$category.'/'.$path] ?? null;
    }

    public function exists(string $category, string $path): bool
    {
        return isset($this->files[$category.'/'.$path]);
    }

    public function delete(string $category, string $path): bool
    {
        if (! $this->deleteSucceeds) {
            return false;
        }
        unset($this->files[$category.'/'.$path]);

        return true;
    }

    public function url(string $category, string $path): ?string { return null; }
    public function files(string $category, string $directory = ''): array { return array_keys($this->files); }
    public function deleteDirectory(string $category, string $directory = ''): bool { return true; }
    public function getBasePath(string $category): string { return '/test/'.$category; }
    public function getDisk(): string { return 'test-public'; }
    public function deleteAll(string $category): bool { $this->files = []; return true; }
    public function response(string $category, string $path, string $filename, array $headers = []): ?StreamedResponse
    {
        return $this->exists($category, $path)
            ? new StreamedResponse(static function (): void {}, 200, $headers)
            : null;
    }
    public function withDisk(string $disk): static { return $this; }
    public function download(string $category, string $path, string $filename, array $headers = []): ?StreamedResponse { return null; }
}

final class TestImageRepository implements ImageUploadRepositoryInterface
{
    /** @var array<int, JwsoftTiptapImageUpload> */
    public array $records = [];
    public bool $failCreate = false;
    public bool $deleted = false;

    public function findByHash(string $hash): ?JwsoftTiptapImageUpload { return null; }
    public function findById(int $id): ?JwsoftTiptapImageUpload { return $this->records[$id] ?? null; }
    public function create(array $data): JwsoftTiptapImageUpload
    {
        if ($this->failCreate) {
            throw new RuntimeException('expected create failure');
        }
        $record = new JwsoftTiptapImageUpload();
        $record->forceFill(array_merge($data, ['id' => count($this->records) + 1, 'hash' => 'abcdef123456']));
        $record->exists = true;
        $this->records[(int) $record->id] = $record;

        return $record;
    }
    public function delete(JwsoftTiptapImageUpload $upload): bool
    {
        $this->deleted = true;
        unset($this->records[(int) $upload->id]);

        return true;
    }
    public function findOlderThan(Carbon $threshold, int $limit): Collection { return new Collection(array_values($this->records)); }
    public function paginateForAdmin(array $filters, int $perPage): LengthAwarePaginator { throw new LogicException('unused'); }
    public function findScanWindow(array $filters, int $limit): Collection { return new Collection(array_values($this->records)); }
    public function findManyByIds(array $ids): Collection { return new Collection(array_values($this->records)); }
}

$png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z4M0AAAAASUVORK5CYII=', true);
$temp = tempnam(sys_get_temp_dir(), 'jwsoft-image-');
if (! is_string($png) || $temp === false) {
    throw new RuntimeException('PNG fixture preparation failed');
}
file_put_contents($temp, $png);
$file = new UploadedFile($temp, 'pixel.png', 'image/png', UPLOAD_ERR_OK, true);

HookManager::resetAll();
$fired = ['legacy_before' => false, 'before' => false, 'legacy_after' => false, 'after' => false];
HookManager::addAction(ImageHookContract::LEGACY_BEFORE_UPLOAD, function () use (&$fired): void { $fired['legacy_before'] = true; });
HookManager::addAction(ImageHookContract::BEFORE_UPLOAD, function () use (&$fired): void { $fired['before'] = true; });
HookManager::addAction(ImageHookContract::LEGACY_AFTER_UPLOAD, function () use (&$fired): void { $fired['legacy_after'] = true; });
HookManager::addAction(ImageHookContract::AFTER_UPLOAD, function () use (&$fired): void { $fired['after'] = true; });

$repository = new TestImageRepository();
$storage = new TestImageStorage();
$record = (new ImageUploadService($repository, $storage))->upload($file, 7, 2);
assertImageSubsystem($record->mime_type === 'image/png', 'trusted MIME must be persisted');
assertImageSubsystem($record->uploaded_by === 7, 'uploader id must be persisted');
assertImageSubsystem(count($storage->files) === 1, 'one physical image must be stored');
assertImageSubsystem(! in_array(false, $fired, true), 'new and legacy image hook contracts must fire');

$served = (new ImageServeService($repository, $storage))->serve($record);
assertImageSubsystem($served instanceof StreamedResponse, 'stored image must produce a streamed response');
$cacheControl = (string) $served->headers->get('Cache-Control');
assertImageSubsystem(
    str_contains($cacheControl, 'max-age=31536000')
        && str_contains($cacheControl, 'public')
        && str_contains($cacheControl, 'immutable'),
    'image cache contract mismatch',
);
assertImageSubsystem($served->headers->get('X-Content-Type-Options') === 'nosniff', 'image response must prevent MIME sniffing');

$failingRepository = new TestImageRepository();
$failingRepository->failCreate = true;
$rollbackStorage = new TestImageStorage();
try {
    (new ImageUploadService($failingRepository, $rollbackStorage))->upload($file, 7, 2);
    throw new RuntimeException('record failure should bubble');
} catch (RuntimeException $exception) {
    assertImageSubsystem($exception->getMessage() === 'expected create failure', 'unexpected upload failure');
}
assertImageSubsystem($rollbackStorage->files === [], 'stored file must be removed when record creation fails');

$invalidTemp = tempnam(sys_get_temp_dir(), 'jwsoft-invalid-image-');
if ($invalidTemp === false) {
    throw new RuntimeException('invalid image fixture preparation failed');
}
file_put_contents($invalidTemp, 'not an image');
try {
    (new ImageUploadService(new TestImageRepository(), new TestImageStorage()))->upload(
        new UploadedFile($invalidTemp, 'spoofed.png', 'image/png', UPLOAD_ERR_OK, true),
        7,
        2,
    );
    throw new RuntimeException('spoofed image should be rejected');
} catch (Plugins\Jwsoft\TiptapEditor\Exceptions\ImageUploadException) {
    // expected: trusted server MIME/dimension validation rejects the spoofed file.
}

$cleanupRepository = new TestImageRepository();
$cleanupRecord = $cleanupRepository->create([
    'original_name' => 'missing.png',
    'file_path' => 'images/2026/08/missing.png',
    'storage_disk' => 'test-public',
    'file_size' => 1,
    'mime_type' => 'image/png',
    'uploaded_by' => 7,
]);
$scanner = new class extends ImageReferenceScanService {
    public function __construct() {}
    public function hasPotentiallyMissingSources(): bool { return false; }
    public function mapReferenced(iterable $uploads): array { return []; }
};
$cleanup = new ImageCleanupService($cleanupRepository, $scanner, new TestImageStorage());
assertImageSubsystem($cleanup->deleteUpload($cleanupRecord), 'missing physical file should clean the orphan record');
assertImageSubsystem($cleanupRepository->deleted, 'orphan record must be deleted');

$preservedRepository = new TestImageRepository();
$preserved = $preservedRepository->create([
    'original_name' => 'preserve.png',
    'file_path' => 'images/2026/08/preserve.png',
    'storage_disk' => 'test-public',
    'file_size' => 1,
    'mime_type' => 'image/png',
    'uploaded_by' => 7,
]);
$undeletableStorage = new TestImageStorage();
$undeletableStorage->files['images/2026/08/preserve.png'] = 'x';
$undeletableStorage->deleteSucceeds = false;
$cleanup = new ImageCleanupService($preservedRepository, $scanner, $undeletableStorage);
assertImageSubsystem(! $cleanup->deleteUpload($preserved), 'physical delete failure must fail closed');
assertImageSubsystem(! $preservedRepository->deleted, 'record must be preserved when physical delete fails');

HookManager::resetAll();
@unlink($temp);
@unlink($invalidTemp);
echo "[jwsoft] G7 image upload, compatibility hooks, rollback, and orphan cleanup passed\n";
