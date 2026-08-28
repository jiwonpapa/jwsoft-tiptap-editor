<?php

namespace Plugins\Jwsoft\TiptapEditor\Repositories;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Plugins\Jwsoft\TiptapEditor\Repositories\Contracts\ImageReferenceSourceRepositoryInterface;

class ImageReferenceSourceRepository implements ImageReferenceSourceRepositoryInterface
{
    public function resolveExistingColumns(string $table, array $columns): array
    {
        if (! $this->validIdentifier($table) || ! Schema::hasTable($table)) {
            return [];
        }

        return array_values(array_filter(
            array_unique(array_map('strval', $columns)),
            fn (string $column): bool => $this->validIdentifier($column) && Schema::hasColumn($table, $column),
        ));
    }

    public function findTokensInSource(string $table, array $columns, array $tokens): array
    {
        if ($columns === [] || $tokens === []) {
            return [];
        }

        $pending = array_values(array_unique(array_filter(array_map('strval', $tokens))));
        $found = [];
        $select = Schema::hasColumn($table, 'id') ? array_merge(['id'], $columns) : $columns;
        $query = DB::table($table)->select($select);

        $inspect = function ($row) use ($columns, &$pending, &$found): bool {
            foreach ($columns as $column) {
                $content = (string) ($row->{$column} ?? '');
                foreach ($pending as $index => $token) {
                    if ($content !== '' && str_contains($content, $token)) {
                        $found[] = $token;
                        unset($pending[$index]);
                    }
                }
            }

            return $pending !== [];
        };

        if (in_array('id', $select, true)) {
            $query->lazyById(200)->each($inspect);
        } else {
            $query->orderBy($columns[0])->lazy(200)->each($inspect);
        }

        return array_values(array_unique($found));
    }

    private function validIdentifier(string $value): bool
    {
        return preg_match('/^[A-Za-z0-9_]+$/', $value) === 1;
    }
}
