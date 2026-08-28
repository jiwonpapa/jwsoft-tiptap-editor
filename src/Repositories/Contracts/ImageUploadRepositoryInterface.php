<?php

namespace Plugins\Jwsoft\TiptapEditor\Repositories\Contracts;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Carbon;
use Plugins\Jwsoft\TiptapEditor\Models\JwsoftTiptapImageUpload;

interface ImageUploadRepositoryInterface
{
    public function findByHash(string $hash): ?JwsoftTiptapImageUpload;
    public function findById(int $id): ?JwsoftTiptapImageUpload;
    public function create(array $data): JwsoftTiptapImageUpload;
    public function delete(JwsoftTiptapImageUpload $upload): bool;
    public function findOlderThan(Carbon $threshold, int $limit): Collection;
    public function paginateForAdmin(array $filters, int $perPage): LengthAwarePaginator;
    public function findScanWindow(array $filters, int $limit): Collection;
    public function findManyByIds(array $ids): Collection;
}
