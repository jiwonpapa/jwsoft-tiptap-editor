<?php

namespace Plugins\Jwsoft\TiptapEditor\Services;

use App\Contracts\Extension\StorageInterface;
use Illuminate\Support\Facades\Log;
use Plugins\Jwsoft\TiptapEditor\Models\JwsoftTiptapMediaUpload;
use Plugins\Jwsoft\TiptapEditor\Repositories\Contracts\MediaUploadRepositoryInterface;
use Symfony\Component\HttpFoundation\StreamedResponse;

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

    public function serve(JwsoftTiptapMediaUpload $media): ?StreamedResponse
    {
        [$category, $relative] = array_pad(explode('/', (string) $media->file_path, 2), 2, '');
        if ($category === '' || $relative === '') {
            return null;
        }
        $rowDisk = (string) $media->storage_disk;
        $useRowDisk = $rowDisk !== ''
            && $rowDisk !== $this->storage->getDisk()
            && config("filesystems.disks.{$rowDisk}") !== null;
        $storage = $useRowDisk ? $this->storage->withDisk($rowDisk) : $this->storage;
        $response = $storage->response($category, $relative, (string) $media->original_name, [
            'Content-Type' => 'video/mp4',
            'Content-Disposition' => 'inline',
            'Cache-Control' => 'public, max-age=31536000, immutable',
            'X-Content-Type-Options' => 'nosniff',
        ]);
        if ($response === null) {
            Log::warning('JWSoft Tiptap MP4 파일 없음', ['media_id' => $media->id, 'hash' => $media->hash]);
        }

        return $response;
    }
}
