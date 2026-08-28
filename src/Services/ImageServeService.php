<?php

namespace Plugins\Jwsoft\TiptapEditor\Services;

use App\Contracts\Extension\StorageInterface;
use Illuminate\Support\Facades\Log;
use Plugins\Jwsoft\TiptapEditor\Models\JwsoftTiptapImageUpload;
use Plugins\Jwsoft\TiptapEditor\Repositories\Contracts\ImageUploadRepositoryInterface;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ImageServeService
{
    public function __construct(
        private readonly ImageUploadRepositoryInterface $repository,
        private readonly StorageInterface $storage,
    ) {}

    public function findByHash(string $hash): ?JwsoftTiptapImageUpload
    {
        return $this->repository->findByHash($hash);
    }

    public function serve(JwsoftTiptapImageUpload $image): ?StreamedResponse
    {
        [$category, $relative] = array_pad(explode('/', (string) $image->file_path, 2), 2, '');
        if ($category === '' || $relative === '') {
            return null;
        }

        $rowDisk = (string) $image->storage_disk;
        $useRowDisk = $rowDisk !== ''
            && $rowDisk !== $this->storage->getDisk()
            && config("filesystems.disks.{$rowDisk}") !== null;
        $storage = $useRowDisk ? $this->storage->withDisk($rowDisk) : $this->storage;
        $response = $storage->response($category, $relative, (string) $image->original_name, [
            'Content-Type' => (string) $image->mime_type,
            'Cache-Control' => 'public, max-age=31536000, immutable',
            'X-Content-Type-Options' => 'nosniff',
        ]);
        if ($response === null) {
            Log::warning('JWSoft Tiptap 이미지 파일 없음', [
                'image_id' => $image->id,
                'hash' => $image->hash,
                'disk' => $rowDisk,
            ]);
        }

        return $response;
    }
}
