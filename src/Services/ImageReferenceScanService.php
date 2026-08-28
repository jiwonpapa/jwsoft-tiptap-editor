<?php

namespace Plugins\Jwsoft\TiptapEditor\Services;

use App\Contracts\Repositories\ModuleRepositoryInterface;
use App\Enums\ExtensionStatus;
use App\Extension\HookManager;
use Illuminate\Support\Facades\Log;
use Plugins\Jwsoft\TiptapEditor\Models\JwsoftTiptapImageUpload;
use Plugins\Jwsoft\TiptapEditor\Repositories\Contracts\ImageReferenceSourceRepositoryInterface;
use Plugins\Jwsoft\TiptapEditor\Support\ImageHookContract;

class ImageReferenceScanService
{
    private const CORE_SOURCES = [
        ['table' => 'notification_templates', 'columns' => ['body']],
        ['table' => 'mail_templates', 'columns' => ['body']],
        ['table' => 'identity_message_templates', 'columns' => ['body']],
        ['table' => 'template_layouts', 'columns' => ['content']],
        ['table' => 'template_layout_extensions', 'columns' => ['content']],
        ['table' => 'template_layout_versions', 'columns' => ['content']],
    ];

    private ?array $resolvedSources = null;

    public function __construct(
        private readonly ImageReferenceSourceRepositoryInterface $sourceRepository,
        private readonly ModuleRepositoryInterface $moduleRepository,
    ) {}

    public function hasPotentiallyMissingSources(): bool
    {
        return $this->moduleRepository->getAll()->contains(
            fn ($module): bool => ! $module->isActive()
                && $module->status !== ExtensionStatus::Uninstalled->value,
        );
    }

    /** @return list<array{table: string, columns: list<string>}> */
    public function getReferenceSources(): array
    {
        if ($this->resolvedSources !== null) {
            return $this->resolvedSources;
        }

        $sources = HookManager::applyFilters(ImageHookContract::LEGACY_FILTER_REFERENCE_SOURCES, self::CORE_SOURCES);
        $sources = HookManager::applyFilters(ImageHookContract::FILTER_REFERENCE_SOURCES, $sources);
        if (! is_array($sources)) {
            Log::warning('JWSoft Tiptap 참조 소스 훅 반환값이 배열이 아닙니다.');
            $sources = self::CORE_SOURCES;
        }

        $valid = [];
        foreach ($sources as $source) {
            if (! is_array($source) || ! isset($source['table'], $source['columns']) || ! is_array($source['columns'])) {
                continue;
            }
            $table = (string) $source['table'];
            $columns = $this->sourceRepository->resolveExistingColumns($table, $source['columns']);
            if ($columns !== []) {
                $valid[] = ['table' => $table, 'columns' => $columns];
            }
        }

        return $this->resolvedSources = $valid;
    }

    /** @return array<int, bool> */
    public function mapReferenced(iterable $uploads): array
    {
        $map = [];
        $owners = [];
        foreach ($uploads as $upload) {
            $tokens = $this->tokens($upload);
            $id = (int) $upload->id;
            $map[$id] = $tokens === [];
            foreach ($tokens as $token) {
                $owners[$token][] = $id;
            }
        }

        $pending = $owners;
        foreach ($this->getReferenceSources() as $source) {
            if ($pending === []) {
                break;
            }
            $found = $this->sourceRepository->findTokensInSource(
                $source['table'],
                $source['columns'],
                array_map('strval', array_keys($pending)),
            );
            foreach ($found as $token) {
                foreach ($pending[$token] ?? [] as $id) {
                    $map[$id] = true;
                }
                unset($pending[$token]);
            }
        }

        return $map;
    }

    /** @return list<string> */
    private function tokens(JwsoftTiptapImageUpload $upload): array
    {
        $tokens = array_filter([(string) $upload->hash, basename((string) $upload->file_path)]);

        return array_values(array_unique($tokens));
    }
}
