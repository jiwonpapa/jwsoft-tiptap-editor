<?php

namespace Plugins\Jwsoft\TiptapEditor\Services;

use Illuminate\Support\Collection;
use Plugins\Jwsoft\TiptapEditor\Models\JwsoftTiptapImageUpload;
use Plugins\Jwsoft\TiptapEditor\Repositories\Contracts\ImageUploadRepositoryInterface;

class ImageUploadAdminService
{
    public const SCAN_WINDOW = 500;

    public function __construct(
        private readonly ImageUploadRepositoryInterface $repository,
        private readonly ImageReferenceScanService $scanner,
        private readonly ImageCleanupService $cleanup,
    ) {}

    public function paginate(array $filters, int $perPage, int $page): array
    {
        $state = (string) ($filters['referenced'] ?? 'all');
        if (in_array($state, ['referenced', 'unreferenced'], true)) {
            return $this->paginateByReference($filters, $perPage, $page, $state === 'referenced');
        }

        $paginator = $this->repository->paginateForAdmin($filters, $perPage, $page);
        $items = collect($paginator->items());
        $this->attachReferences($items);

        return [
            'items' => $items,
            'pagination' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'from' => $paginator->firstItem(),
                'to' => $paginator->lastItem(),
            ],
            'scan_limited' => false,
            'reference_sources_incomplete' => $this->scanner->hasPotentiallyMissingSources(),
        ];
    }

    public function find(int $id): ?JwsoftTiptapImageUpload
    {
        return $this->repository->findById($id);
    }

    public function delete(JwsoftTiptapImageUpload $upload): bool
    {
        return $this->cleanup->deleteUpload($upload);
    }

    /**
     * @return array{
     *     requested:int,
     *     deleted:int,
     *     failed:int,
     *     missing:int,
     *     failed_ids:list<int>,
     *     missing_ids:list<int>
     * }
     */
    public function bulkDelete(array $ids): array
    {
        $requestedIds = array_values(array_unique(array_map('intval', $ids)));
        $uploads = $this->repository->findManyByIds($requestedIds);
        $foundIds = $uploads->mapWithKeys(
            fn (JwsoftTiptapImageUpload $upload): array => [(int) $upload->id => true],
        )->all();
        $missingIds = array_values(array_filter(
            $requestedIds,
            fn (int $id): bool => ! isset($foundIds[$id]),
        ));
        $result = [
            'requested' => count($requestedIds),
            'deleted' => 0,
            'failed' => count($missingIds),
            'missing' => count($missingIds),
            'failed_ids' => $missingIds,
            'missing_ids' => $missingIds,
        ];

        foreach ($uploads as $upload) {
            if ($this->cleanup->deleteUpload($upload)) {
                $result['deleted']++;
            } else {
                $result['failed']++;
                $result['failed_ids'][] = (int) $upload->id;
            }
        }

        return $result;
    }

    private function paginateByReference(array $filters, int $perPage, int $page, bool $wanted): array
    {
        $window = $this->repository->findScanWindow($filters, self::SCAN_WINDOW);
        $this->attachReferences($window);
        $matched = $window->filter(fn (JwsoftTiptapImageUpload $upload): bool => (bool) $upload->referenced === $wanted);
        $sortBy = (string) ($filters['sort_by'] ?? 'created_at');
        $sortDirection = (string) ($filters['sort_order'] ?? 'desc');
        $matched = $matched->sortBy([[$sortBy, $sortDirection], ['id', 'desc']])->values();
        $total = $matched->count();
        $last = max(1, (int) ceil($total / max(1, $perPage)));
        $current = max(1, min($page, $last));
        $items = $matched->slice(($current - 1) * $perPage, $perPage)->values();

        return [
            'items' => $items,
            'pagination' => [
                'current_page' => $current,
                'last_page' => $last,
                'per_page' => $perPage,
                'total' => $total,
                'from' => $items->isEmpty() ? null : (($current - 1) * $perPage) + 1,
                'to' => $items->isEmpty() ? null : (($current - 1) * $perPage) + $items->count(),
            ],
            'scan_limited' => $window->count() >= self::SCAN_WINDOW,
            'reference_sources_incomplete' => $this->scanner->hasPotentiallyMissingSources(),
        ];
    }

    private function attachReferences(Collection $uploads): void
    {
        $references = $this->scanner->mapReferenced($uploads);
        foreach ($uploads as $upload) {
            $upload->setAttribute('referenced', $references[(int) $upload->id] ?? true);
        }
    }
}
