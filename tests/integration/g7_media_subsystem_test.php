<?php

use App\Contracts\Extension\StorageInterface;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Events\Dispatcher;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Facade;
use Plugins\Jwsoft\TiptapEditor\Exceptions\MediaUploadException;
use Plugins\Jwsoft\TiptapEditor\Models\JwsoftTiptapMediaUpload;
use Plugins\Jwsoft\TiptapEditor\Models\JwsoftTiptapMediaUploadSession;
use Plugins\Jwsoft\TiptapEditor\Repositories\Contracts\MediaUploadRepositoryInterface;
use Plugins\Jwsoft\TiptapEditor\Services\MediaServeService;
use Plugins\Jwsoft\TiptapEditor\Services\MediaUploadService;
use Symfony\Component\HttpFoundation\StreamedResponse;

$g7Root = $argv[1] ?? '';
$projectRoot = $argv[2] ?? '';
require $g7Root.'/vendor/autoload.php';
require $projectRoot.'/vendor/autoload.php';

$container = new Illuminate\Container\Container();
Illuminate\Container\Container::setInstance($container);
$container->instance('events', new Dispatcher($container));
$container->instance('config', new Illuminate\Config\Repository(['filesystems' => ['disks' => []]]));
$container->instance('log', new class {
    public function warning(string $message, array $context = []): void {}
    public function error(string $message, array $context = []): void {}
});
Facade::setFacadeApplication($container);

function assertMediaSubsystem(bool $condition, string $message): void
{
    if (! $condition) {
        throw new RuntimeException($message);
    }
}

final class TestMediaStorage implements StorageInterface
{
    public ?string $localBase = null;
    /** @var array<string, string> */
    public array $files = [];

    public function put(string $category, string $path, mixed $content): bool
    {
        if (is_resource($content)) {
            $position = ftell($content);
            $value = stream_get_contents($content);
            if (is_int($position)) {
                fseek($content, $position);
            }
            $content = $value;
        }
        if (! is_string($content)) {
            return false;
        }
        $this->files[$category.'/'.$path] = $content;

        return true;
    }
    public function get(string $category, string $path): ?string { return $this->files[$category.'/'.$path] ?? null; }
    public function exists(string $category, string $path): bool { return isset($this->files[$category.'/'.$path]); }
    public function delete(string $category, string $path): bool { unset($this->files[$category.'/'.$path]); return true; }
    public function url(string $category, string $path): ?string { return null; }
    public function files(string $category, string $directory = ''): array
    {
        $prefix = $category.'/'.trim($directory, '/');

        return array_values(array_filter(array_keys($this->files), static fn (string $path): bool => str_starts_with($path, $prefix)));
    }
    public function deleteDirectory(string $category, string $directory = ''): bool
    {
        foreach ($this->files($category, $directory) as $path) {
            unset($this->files[$path]);
        }

        return true;
    }
    public function getBasePath(string $category): string { return $this->localBase ?? '/test/'.$category; }
    public function getDisk(): string { return 'test-public'; }
    public function deleteAll(string $category): bool { return $this->deleteDirectory($category); }
    public function response(string $category, string $path, string $filename, array $headers = []): ?StreamedResponse
    {
        return $this->exists($category, $path)
            ? new StreamedResponse(static function (): void {}, 200, $headers)
            : null;
    }
    public function withDisk(string $disk): static { return $this; }
    public function download(string $category, string $path, string $filename, array $headers = []): ?StreamedResponse { return null; }
}

final class TestMediaRepository implements MediaUploadRepositoryInterface
{
    /** @var array<string, JwsoftTiptapMediaUploadSession> */
    public array $sessions = [];
    /** @var array<string, JwsoftTiptapMediaUpload> */
    public array $uploads = [];

    public function createSession(array $data): JwsoftTiptapMediaUploadSession
    {
        $session = new JwsoftTiptapMediaUploadSession();
        $session->forceFill(array_merge($data, ['id' => count($this->sessions) + 1]));
        $session->exists = true;
        $this->sessions[(string) $session->token] = $session;

        return $session;
    }
    public function findSessionByToken(string $token): ?JwsoftTiptapMediaUploadSession { return $this->sessions[$token] ?? null; }
    public function recordPart(string $token, int $part, string $checksum): ?JwsoftTiptapMediaUploadSession
    {
        $session = $this->sessions[$token] ?? null;
        if (! $session || $session->status !== 'pending') return null;
        $received = is_array($session->received_parts) ? $session->received_parts : [];
        $received[(string) $part] = $checksum;
        $session->received_parts = $received;

        return $session;
    }
    public function claimForCompletion(string $token): ?JwsoftTiptapMediaUploadSession
    {
        $session = $this->sessions[$token] ?? null;
        if (! $session || $session->status !== 'pending') return null;
        $session->status = 'assembling';

        return $session;
    }
    public function restorePending(JwsoftTiptapMediaUploadSession $session): void { $session->status = 'pending'; }
    public function deleteSession(JwsoftTiptapMediaUploadSession $session): bool { unset($this->sessions[(string) $session->token]); return true; }
    public function findExpiredSessions(Carbon $now, int $limit): Collection
    {
        return new Collection(array_slice(array_values(array_filter(
            $this->sessions,
            static fn (JwsoftTiptapMediaUploadSession $session): bool => $session->expires_at->lte($now),
        )), 0, $limit));
    }
    public function createUpload(array $data): JwsoftTiptapMediaUpload
    {
        $upload = new JwsoftTiptapMediaUpload();
        $upload->forceFill(array_merge($data, [
            'id' => count($this->uploads) + 1,
            'hash' => '123456abcdef',
        ]));
        $upload->exists = true;
        $this->uploads[(string) $upload->hash] = $upload;

        return $upload;
    }
    public function findUploadByHash(string $hash): ?JwsoftTiptapMediaUpload { return $this->uploads[$hash] ?? null; }
}

function uploadedChunk(string $contents): array
{
    $temp = tempnam(sys_get_temp_dir(), 'jwsoft-media-');
    if ($temp === false) throw new RuntimeException('media fixture preparation failed');
    file_put_contents($temp, $contents);

    return [new UploadedFile($temp, 'part.bin', 'application/octet-stream', UPLOAD_ERR_OK, true), $temp];
}

$mp4 = pack('N', 24).'ftyp'.'isom'.pack('N', 0).'isom'.'mp41'.pack('N', 8).'mdat';
$repository = new TestMediaRepository();
$storage = new TestMediaStorage();
$service = new MediaUploadService($repository, $storage);
$session = $service->begin('sample.mp4', strlen($mp4), 7, 200, 5);
assertMediaSubsystem($session->total_parts === 1, 'small MP4 should use one chunk');
assertMediaSubsystem(strlen((string) $session->token) === 32, 'session token entropy contract mismatch');
[$chunk, $temp] = uploadedChunk($mp4);

try {
    $service->storePart((string) $session->token, 0, $chunk, str_repeat('0', 64), 7);
    throw new RuntimeException('wrong chunk checksum should be rejected');
} catch (MediaUploadException) {
    // expected
}
$checksum = hash('sha256', $mp4);
$storedSession = $service->storePart((string) $session->token, 0, $chunk, $checksum, 7);
assertMediaSubsystem($storedSession->received_parts['0'] === $checksum, 'received part checksum must persist');
$service->storePart((string) $session->token, 0, $chunk, $checksum, 7);
assertMediaSubsystem(count($storage->files) === 1, 'idempotent chunk retry must not duplicate files');

$record = $service->complete((string) $session->token, 7);
assertMediaSubsystem($record->mime_type === 'video/mp4', 'trusted media MIME must persist');
assertMediaSubsystem($record->file_size === strlen($mp4), 'assembled media size mismatch');
assertMediaSubsystem(count(array_filter(array_keys($storage->files), static fn (string $path): bool => str_starts_with($path, 'media-temp/'))) === 0, 'temporary chunks must be removed');
assertMediaSubsystem(count(array_filter(array_keys($storage->files), static fn (string $path): bool => str_starts_with($path, 'media/'))) === 1, 'one final MP4 must be stored');

$served = (new MediaServeService($repository, $storage))->serve($record);
assertMediaSubsystem($served instanceof StreamedResponse, 'stored MP4 must produce a streamed response');
assertMediaSubsystem($served->headers->get('Content-Type') === 'video/mp4', 'MP4 response MIME mismatch');
assertMediaSubsystem($served->headers->get('X-Content-Type-Options') === 'nosniff', 'MP4 response must prevent MIME sniffing');

$localFixture = sys_get_temp_dir().'/jwsoft-range-'.bin2hex(random_bytes(8));
mkdir($localFixture);
file_put_contents($localFixture.'/range.mp4', $mp4);
$storage->localBase = $localFixture;
$container->make('config')->set('filesystems.disks.test-public.driver', 'local');
$rangeRecord = clone $record;
$rangeRecord->file_path = 'media/range.mp4';
$rangeRecord->original_name = '실제 영상.mp4';
try {
    $rangeResponse = (new MediaServeService($repository, $storage))->serve($rangeRecord);
    assertMediaSubsystem($rangeResponse instanceof Symfony\Component\HttpFoundation\BinaryFileResponse, 'local media needs a range-capable response');
    $rangeResponse->prepare(Illuminate\Http\Request::create('/video', 'GET', [], [], [], ['HTTP_RANGE' => 'bytes=0-7']));
    assertMediaSubsystem($rangeResponse->getStatusCode() === 206, 'local MP4 range must return 206');
    assertMediaSubsystem($rangeResponse->headers->get('Content-Length') === '8', 'range length must be bounded');
    assertMediaSubsystem(str_contains($rangeResponse->headers->get('Content-Disposition'), '.mp4'), 'download filename must retain its extension');
    $invalidRange = (new MediaServeService($repository, $storage))->serve($rangeRecord);
    $invalidRange->prepare(Illuminate\Http\Request::create('/video', 'GET', [], [], [], ['HTTP_RANGE' => 'bytes=999999-1000000']));
    assertMediaSubsystem($invalidRange->getStatusCode() === 416, 'out-of-bounds range must return 416');
    $rangeRecord->file_path = 'media/../outside.mp4';
    assertMediaSubsystem((new MediaServeService($repository, $storage))->serve($rangeRecord) === null, 'media path traversal must fail closed');
} finally {
    unlink($localFixture.'/range.mp4');
    rmdir($localFixture);
    $storage->localBase = null;
    $container->make('config')->set('filesystems.disks.test-public.driver', null);
}

$expired = $service->begin('expired.mp4', strlen($mp4), 7, 200, 5);
$expired->expires_at = Carbon::now()->subMinute();
$storage->files['media-temp/sessions/'.$expired->token.'/000000.part'] = $mp4;
$pruned = $service->pruneExpired(20);
assertMediaSubsystem($pruned['deleted'] === 1, 'expired upload session must be pruned');
assertMediaSubsystem(! isset($repository->sessions[(string) $expired->token]), 'expired session record must be removed');

@unlink($temp);
echo "[jwsoft] G7 MP4 chunk upload, retry, assembly, serving, and expiry cleanup passed\n";
