<?php

use App\Contracts\Extension\StorageInterface;
use App\Extension\HookManager;
use App\Repositories\ModuleRepository;
use App\Rules\ValidLayoutStructure;
use App\Rules\WhitelistedEndpoint;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Capsule\Manager as Capsule;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Events\Dispatcher;
use Illuminate\Http\UploadedFile;
use Illuminate\Routing\Router;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Facade;
use Illuminate\Support\Facades\Route;
use Plugins\Jwsoft\TiptapEditor\Models\JwsoftTiptapImageUpload;
use Plugins\Jwsoft\TiptapEditor\Repositories\Contracts\ImageUploadRepositoryInterface;
use Plugins\Jwsoft\TiptapEditor\Repositories\ImageReferenceSourceRepository;
use Plugins\Jwsoft\TiptapEditor\Repositories\ImageUploadRepository;
use Plugins\Jwsoft\TiptapEditor\Services\ImageCleanupService;
use Plugins\Jwsoft\TiptapEditor\Services\ImageReferenceScanService;
use Plugins\Jwsoft\TiptapEditor\Services\ImageServeService;
use Plugins\Jwsoft\TiptapEditor\Services\ImageUploadAdminService;
use Plugins\Jwsoft\TiptapEditor\Services\ImageUploadService;
use Plugins\Jwsoft\TiptapEditor\Support\ImageHookContract;
use Symfony\Component\HttpFoundation\StreamedResponse;

$g7Root = $argv[1] ?? '';
$projectRoot = $argv[2] ?? '';
require $g7Root.'/vendor/autoload.php';
require $projectRoot.'/vendor/autoload.php';

$container = new class extends Illuminate\Container\Container {
    public function runningUnitTests(): bool { return true; }
};
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

$router = new Router($container['events'], $container);
$container->instance('router', $router);
Route::prefix('api/plugins/jwsoft-tiptap-editor')
    ->name('api.plugins.jwsoft-tiptap-editor.')
    ->middleware('api')
    ->group($projectRoot.'/src/routes/api.php');

$adminRoutes = [];
foreach ($router->getRoutes() as $route) {
    if (str_contains($route->uri(), 'jwsoft-tiptap-editor/admin/uploads')) {
        $adminRoutes[$route->uri().'|'.implode(',', $route->methods())] = $route;
    }
}
$expectedAdminRoutes = [
    'api/plugins/jwsoft-tiptap-editor/admin/uploads|GET,HEAD' => 'jwsoft-tiptap-editor.uploads.read',
    'api/plugins/jwsoft-tiptap-editor/admin/uploads/bulk-delete|POST' => 'jwsoft-tiptap-editor.uploads.delete',
    'api/plugins/jwsoft-tiptap-editor/admin/uploads/{id}|DELETE' => 'jwsoft-tiptap-editor.uploads.delete',
];
assertImageSubsystem(count($adminRoutes) === count($expectedAdminRoutes), 'admin upload route count mismatch');
foreach ($expectedAdminRoutes as $key => $permission) {
    $middleware = isset($adminRoutes[$key]) ? $adminRoutes[$key]->middleware() : [];
    assertImageSubsystem(isset($adminRoutes[$key]), "missing admin upload route: {$key}");
    assertImageSubsystem(in_array('api', $middleware, true), "admin route is missing api middleware: {$key}");
    assertImageSubsystem(in_array('auth:sanctum', $middleware, true), "admin route is missing auth middleware: {$key}");
    assertImageSubsystem(
        in_array('permission:admin,'.$permission, $middleware, true),
        "admin route is missing permission middleware: {$key}",
    );
}

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
    public function findOlderThan(Carbon $threshold, int $limit, int $afterId = 0): Collection
    {
        return new Collection(array_slice(array_values(array_filter($this->records, fn ($row) => $row->id > $afterId)), 0, $limit));
    }
    public function paginateForAdmin(array $filters, int $perPage, int $page): LengthAwarePaginator { throw new LogicException('unused'); }
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
$cache = new class('jwsoft-tiptap-editor', 'array') extends App\Extension\Cache\PluginCacheDriver {
    private ?Illuminate\Cache\Repository $memory = null;
    protected function store(): Illuminate\Cache\Repository { return $this->memory ??= new Illuminate\Cache\Repository(new Illuminate\Cache\ArrayStore()); }
};
$cleanup = new ImageCleanupService($cleanupRepository, $scanner, new TestImageStorage(), $cache);
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
$cleanup = new ImageCleanupService($preservedRepository, $scanner, $undeletableStorage, $cache);
assertImageSubsystem(! $cleanup->deleteUpload($preserved), 'physical delete failure must fail closed');
assertImageSubsystem(! $preservedRepository->deleted, 'record must be preserved when physical delete fails');

// The first referenced page must not starve a later unused upload.
$queueRepository = new TestImageRepository();
for ($id = 1; $id <= 3; $id++) {
    $queueRepository->create([
        'original_name' => 'cleanup.png', 'file_path' => 'images/cleanup-'.$id.'.png',
        'storage_disk' => 'test-public', 'file_size' => 1,
    ]);
}
$queueScanner = new class extends ImageReferenceScanService {
    public function __construct() {}
    public function hasPotentiallyMissingSources(): bool { return false; }
    public function mapReferenced(iterable $uploads): array
    {
        $result = [];
        foreach ($uploads as $upload) { $result[(int) $upload->id] = $upload->id <= 2; }
        return $result;
    }
};
$cache->forget('image-cleanup-cursor:30');
$queue = new ImageCleanupService($queueRepository, $queueScanner, new TestImageStorage(), $cache);
assertImageSubsystem($queue->pruneUnused(30, 2)['referenced'] === 2, 'first window must preserve referenced images');
assertImageSubsystem($queue->pruneUnused(30, 2, true)['referenced'] === 2, 'dry-run must not consume cursor');
assertImageSubsystem($queue->pruneUnused(30, 2)['deleted'] === 1, 'second window must reach the unused image');
assertImageSubsystem($queue->pruneUnused(30, 2)['referenced'] === 2, 'finished cursor must wrap safely');

$failedScanner = new class extends ImageReferenceScanService {
    public function __construct() {}
    public function hasPotentiallyMissingSources(): bool { return false; }
    public function mapReferenced(iterable $uploads): array { return [1 => false]; }
};
$failedCleanup = new ImageCleanupService($preservedRepository, $failedScanner, $undeletableStorage, $cache);
$command = new Plugins\Jwsoft\TiptapEditor\Console\Commands\PruneUnusedImagesCommand($failedCleanup);
$command->setLaravel($container);
$tester = new Symfony\Component\Console\Tester\CommandTester($command);
assertImageSubsystem($tester->execute(['--days' => 1, '--limit' => 1]) === 1, 'failed delete must fail the command');
assertImageSubsystem(! $preservedRepository->deleted, 'failed command must keep its record');

$capsule = new Capsule($container);
$capsule->addConnection([
    'driver' => 'sqlite',
    'database' => ':memory:',
    'prefix' => '',
]);
$capsule->setEventDispatcher($container['events']);
$capsule->setAsGlobal();
$capsule->bootEloquent();
$container->instance('db', $capsule->getDatabaseManager());
$container->instance('db.schema', $capsule->schema());

$schema = $capsule->schema();
$schema->create('users', function ($table): void {
    $table->id();
    $table->string('name');
});
$schema->create('jwsoft_tiptap_image_uploads', function ($table): void {
    $table->id();
    $table->string('hash', 12)->unique();
    $table->string('original_name');
    $table->string('file_path');
    $table->string('storage_disk');
    $table->unsignedBigInteger('file_size');
    $table->string('mime_type');
    $table->unsignedBigInteger('uploaded_by')->nullable();
    $table->timestamps();
});
foreach ([
    'board_posts' => 'content',
    'ecommerce_products' => 'description',
    'ecommerce_product_common_infos' => 'content',
    'pages' => 'content',
] as $table => $column) {
    $schema->create($table, function ($blueprint) use ($column): void {
        $blueprint->id();
        $blueprint->text($column)->nullable();
    });
}

$moduleRepository = new class extends ModuleRepository {
    public function getAll(): Collection
    {
        return new Collection();
    }
};
$sourceRepository = new ImageReferenceSourceRepository();
$adminScanner = new ImageReferenceScanService($sourceRepository, $moduleRepository);
$sourceTables = array_column($adminScanner->getReferenceSources(), 'table');
foreach (['board_posts', 'ecommerce_products', 'ecommerce_product_common_infos', 'pages'] as $table) {
    assertImageSubsystem(in_array($table, $sourceTables, true), "official editor reference source missing: {$table}");
}

$databaseRepository = new ImageUploadRepository(new JwsoftTiptapImageUpload());
$databaseStorage = new TestImageStorage();
$adminRecords = [];
foreach ([
    ['hash' => '111111111111', 'name' => 'referenced.png'],
    ['hash' => '222222222222', 'name' => 'single.png'],
    ['hash' => '333333333333', 'name' => 'bulk.png'],
] as $fixture) {
    $adminRecords[] = $databaseRepository->create([
        'hash' => $fixture['hash'],
        'original_name' => $fixture['name'],
        'file_path' => 'images/admin/'.$fixture['hash'].'.png',
        'storage_disk' => 'test-public',
        'file_size' => 10,
        'mime_type' => 'image/png',
        'uploaded_by' => null,
    ]);
    $databaseStorage->files['images/admin/'.$fixture['hash'].'.png'] = 'image';
}
$capsule->table('pages')->insert([
    'content' => json_encode(['ko' => '<img src="/api/plugins/jwsoft-tiptap-editor/images/111111111111">'], JSON_THROW_ON_ERROR),
]);

$adminService = new ImageUploadAdminService(
    $databaseRepository,
    $adminScanner,
    new ImageCleanupService($databaseRepository, $adminScanner, $databaseStorage, $cache),
);
$pageTwo = $adminService->paginate([], 1, 2);
assertImageSubsystem($pageTwo['pagination']['current_page'] === 2, 'admin pagination must honor the requested page');
assertImageSubsystem($pageTwo['items']->count() === 1, 'admin pagination page size mismatch');
$referencedOnly = $adminService->paginate(['referenced' => 'referenced'], 20, 1);
assertImageSubsystem($referencedOnly['pagination']['total'] === 1, 'reference filter must find the official page source');
assertImageSubsystem((string) $referencedOnly['items']->first()?->hash === '111111111111', 'reference filter returned wrong upload');

$single = $adminService->find((int) $adminRecords[1]->id);
assertImageSubsystem($single !== null && $adminService->delete($single), 'single admin deletion failed');
assertImageSubsystem($databaseRepository->findById((int) $adminRecords[1]->id) === null, 'single deletion record survived');
assertImageSubsystem(! isset($databaseStorage->files['images/admin/222222222222.png']), 'single deletion file survived');

$bulk = $adminService->bulkDelete([(int) $adminRecords[2]->id, 999999]);
assertImageSubsystem($bulk['requested'] === 2, 'bulk deletion requested count mismatch');
assertImageSubsystem($bulk['deleted'] === 1, 'bulk deletion deleted count mismatch');
assertImageSubsystem($bulk['failed'] === 1 && $bulk['missing'] === 1, 'bulk deletion must report a raced missing record');
assertImageSubsystem($bulk['failed_ids'] === [999999], 'bulk deletion failed ids mismatch');
assertImageSubsystem($bulk['missing_ids'] === [999999], 'bulk deletion missing ids mismatch');
assertImageSubsystem($databaseRepository->findById((int) $adminRecords[2]->id) === null, 'bulk deletion record survived');
assertImageSubsystem(! isset($databaseStorage->files['images/admin/333333333333.png']), 'bulk deletion file survived');
assertImageSubsystem($databaseRepository->findById((int) $adminRecords[0]->id) !== null, 'unselected upload was deleted');

HookManager::resetAll();
@unlink($temp);
@unlink($invalidTemp);
echo "[jwsoft] G7 image upload, admin routes/list/delete, reference scan, rollback, and orphan cleanup passed\n";
