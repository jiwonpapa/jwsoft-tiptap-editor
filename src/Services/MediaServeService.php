<?php

namespace Plugins\Jwsoft\TiptapEditor\Services;

use App\Contracts\Extension\StorageInterface;
use Illuminate\Support\Facades\Log;
use Plugins\Jwsoft\TiptapEditor\Models\JwsoftTiptapMediaUpload;
use Plugins\Jwsoft\TiptapEditor\Repositories\Contracts\MediaUploadRepositoryInterface;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpFoundation\ResponseHeaderBag;

class MediaServeService
{
    public function __construct(
        private readonly MediaUploadRepositoryInterface $repository,
        private readonly StorageInterface $storage,
    ) {}

    public function findByHash(string $hash): ?JwsoftTiptapMediaUpload
    {
        return $this->repository->findUploadByHash($hash);
    }

    public function serve(JwsoftTiptapMediaUpload $media): ?Response
    {
        [$category, $relative] = array_pad(explode('/', (string) $media->file_path, 2), 2, '');
        if ($category !== 'media' || $relative === '' || str_contains($relative, '..')
            || str_contains($relative, '\\') || str_starts_with($relative, '/')) {
            return null;
        }
        $rowDisk = (string) $media->storage_disk;
        $useRowDisk = $rowDisk !== ''
            && $rowDisk !== $this->storage->getDisk()
            && config("filesystems.disks.{$rowDisk}") !== null;
        $storage = $useRowDisk ? $this->storage->withDisk($rowDisk) : $this->storage;
        $headers = [
            'Content-Type' => 'video/mp4',
            'Cache-Control' => 'public, max-age=31536000, immutable',
            'X-Content-Type-Options' => 'nosniff',
        ];
        $filename = preg_replace('/[\\x00-\\x1f\\x7f\/\\\\\\\\]/', '_', (string) $media->original_name);
        $filename = $filename !== null && $filename !== '' ? $filename : 'video.mp4';
        if (in_array(config('filesystems.disks.'.$storage->getDisk().'.driver'), ['local', 'local-safe'], true)) {
            // Resolve exclusively through the G7 storage contract; never infer its root.
            $base = realpath($storage->getBasePath($category));
            $path = $base ? realpath($base.'/'.$relative) : false;
            if (! $base || ! $path || ! str_starts_with($path, $base.DIRECTORY_SEPARATOR) || ! is_file($path)) {
                return null;
            }
            $response = new BinaryFileResponse($path, 200, $headers);
            $response->setContentDisposition('inline', $filename, 'video.mp4');

            return $response;
        }
        $headers['Content-Disposition'] = (new ResponseHeaderBag())->makeDisposition('inline', $filename, 'video.mp4');
        $response = $storage->response($category, $relative, $filename, $headers);
        if ($response === null) {
            Log::warning('JWSoft Tiptap MP4 파일 없음', ['media_id' => $media->id, 'hash' => $media->hash]);
        }

        return $response;
    }
}
