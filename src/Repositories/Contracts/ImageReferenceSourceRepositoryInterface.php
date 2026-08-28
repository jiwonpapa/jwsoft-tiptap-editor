<?php

namespace Plugins\Jwsoft\TiptapEditor\Repositories\Contracts;

interface ImageReferenceSourceRepositoryInterface
{
    /** @return list<string> */
    public function resolveExistingColumns(string $table, array $columns): array;

    /** @return list<string> */
    public function findTokensInSource(string $table, array $columns, array $tokens): array;
}
