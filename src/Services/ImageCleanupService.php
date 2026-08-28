<?php

namespace Plugins\Jwsoft\TiptapEditor\Services;

use App\Contracts\Extension\StorageInterface;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Log;
use Plugins\Jwsoft\TiptapEditor\Models\JwsoftTiptapImageUpload;
use Plugins\Jwsoft\TiptapEditor\Repositories\Contracts\ImageUploadRepositoryInterface;

class ImageCleanupService
{
    public function __construct(
        private readonly ImageUploadRepositoryInterface $repository,
        private readonly ImageReferenceScanService $scanner,
        private readonly StorageInterface $storage,
    ) {}

    /** @return array{scanned:int, referenced:int, deleted:int, failed:int, items:array, skipped_reason?:string} */
    public function pruneUnused(int $days, int $limit, bool $dryRun = false): array
    {
        if (! $dryRun && $this->scanner->hasPotentiallyMissingSources()) {
            Log::warning('JWSoft Tiptap 미사용 이미지 정리 건너뜀: 참조 소스 불완전');

            return ['scanned' => 0, 'referenced' => 0, 'deleted' => 0, 'failed' => 0, 'items' => [], 'skipped_reason' => 'sources_incomplete'];
        }

        $candidates = $this->repository->findOlderThan(Carbon::now()->subDays(max(1, $days)), max(1, $limit));
        $references = $this->scanner->mapReferenced($candidates);
        $result = ['scanned' => $candidates->count(), 'referenced' => 0, 'deleted' => 0, 'failed' => 0, 'items' => []];

        foreach ($candidates as $upload) {
            if ($references[(int) $upload->id] ?? true) {
                $result['referenced']++;
                continue;
            }
            if ($dryRun) {
                $result['items'][] = $this->describe($upload, 'would_delete');
            } elseif ($this->deleteUpload($upload)) {
                $result['deleted']++;
                $result['items'][] = $this->describe($upload, 'deleted');
            } else {
                $result['failed']++;
                $result['items'][] = $this->describe($upload, 'failed');
            }
        }

        return $result;
    }

    public function deleteUpload(JwsoftTiptapImageUpload $upload): bool
    {
        [$category, $relative] = array_pad(explode('/', (string) $upload->file_path, 2), 2, '');
        if ($category === '' || $relative === '') {
            Log::warning('JWSoft Tiptap 업로드 경로 불량: 레코드만 정리', ['image_id' => $upload->id]);

            return $this->repository->delete($upload);
        }

        $disk = (string) $upload->storage_disk;
        $useRowDisk = $disk !== ''
            && $disk !== $this->storage->getDisk()
            && config("filesystems.disks.{$disk}") !== null;
        $storage = $useRowDisk ? $this->storage->withDisk($disk) : $this->storage;

        if ($storage->exists($category, $relative) && ! $storage->delete($category, $relative)) {
            Log::warning('JWSoft Tiptap 이미지 파일 삭제 실패: 레코드 보존', [
                'image_id' => $upload->id,
                'disk' => $disk,
            ]);

            return false;
        }

        return $this->repository->delete($upload);
    }

    private function describe(JwsoftTiptapImageUpload $upload, string $status): array
    {
        return [
            'id' => (int) $upload->id,
            'hash' => (string) $upload->hash,
            'original_name' => (string) $upload->original_name,
            'file_size' => (int) $upload->file_size,
            'created_at' => $upload->created_at?->toDateTimeString(),
            'status' => $status,
        ];
    }
}
