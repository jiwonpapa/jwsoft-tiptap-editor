<?php

namespace Plugins\Jwsoft\TiptapEditor\Repositories;

use App\Repositories\Concerns\FiltersByDateRange;
use App\Repositories\Concerns\ResolvesSortSpec;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Carbon;
use Plugins\Jwsoft\TiptapEditor\Models\JwsoftTiptapImageUpload;
use Plugins\Jwsoft\TiptapEditor\Repositories\Contracts\ImageUploadRepositoryInterface;

class ImageUploadRepository implements ImageUploadRepositoryInterface
{
    use FiltersByDateRange;
    use ResolvesSortSpec;

    private const COLUMNS = [
        'id', 'hash', 'original_name', 'file_path', 'storage_disk',
        'file_size', 'mime_type', 'uploaded_by', 'created_at',
    ];

    private const SORTABLE = ['created_at', 'file_size', 'original_name'];

    public function __construct(private readonly JwsoftTiptapImageUpload $model) {}

    public function findByHash(string $hash): ?JwsoftTiptapImageUpload
    {
        return $this->model->newQuery()->where('hash', $hash)->first();
    }

    public function findById(int $id): ?JwsoftTiptapImageUpload
    {
        return $this->model->newQuery()->find($id, self::COLUMNS);
    }

    public function create(array $data): JwsoftTiptapImageUpload
    {
        return $this->model->newQuery()->create($data);
    }

    public function delete(JwsoftTiptapImageUpload $upload): bool
    {
        return (bool) $upload->delete();
    }

    public function findOlderThan(Carbon $threshold, int $limit): Collection
    {
        return $this->model->newQuery()
            ->where('created_at', '<', $threshold)
            ->orderBy('created_at')->orderBy('id')
            ->limit($limit)->get(self::COLUMNS);
    }

    public function paginateForAdmin(array $filters, int $perPage, int $page): LengthAwarePaginator
    {
        $sort = $this->resolveSortSpec(
            $filters,
            self::SORTABLE,
            defaultColumn: 'created_at',
            defaultDirection: 'desc',
        )[0];
        $query = $this->applyFilters($this->model->newQuery(), $filters)
            ->with('uploader:id,name')
            ->orderBy($sort['column'], $sort['direction']);
        if ($sort['column'] !== 'id') {
            $query->orderBy('id', $sort['direction']);
        }

        return $query->paginate($perPage, self::COLUMNS, 'page', max(1, $page));
    }

    public function findScanWindow(array $filters, int $limit): Collection
    {
        return $this->applyFilters($this->model->newQuery(), $filters)
            ->with('uploader:id,name')
            ->orderByDesc('created_at')->orderByDesc('id')
            ->limit($limit)->get(self::COLUMNS);
    }

    public function findManyByIds(array $ids): Collection
    {
        if ($ids === []) {
            return new Collection();
        }

        return $this->model->newQuery()->whereIn('id', $ids)->get(self::COLUMNS);
    }

    private function applyFilters(Builder $query, array $filters): Builder
    {
        $search = trim((string) ($filters['search'] ?? ''));
        if ($search !== '') {
            $escaped = addcslashes($search, '\\%_');
            $query->where(function (Builder $inner) use ($escaped): void {
                $inner->where('original_name', 'like', '%'.$escaped.'%')
                    ->orWhere('hash', 'like', '%'.$escaped.'%');
            });
        }

        $this->applyDateRangeFilter($query, 'created_at', $filters['date_from'] ?? null, $filters['date_to'] ?? null);

        return $query;
    }
}
