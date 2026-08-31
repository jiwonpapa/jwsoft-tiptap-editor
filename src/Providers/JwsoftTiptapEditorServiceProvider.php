<?php

namespace Plugins\Jwsoft\TiptapEditor\Providers;

use App\Contracts\Extension\PluginManagerInterface;
use App\Contracts\Repositories\PluginRepositoryInterface;
use App\Extension\BasePluginServiceProvider;
use App\Extension\HookManager;
use Plugins\Jwsoft\TiptapEditor\Console\Commands\PruneUnusedImagesCommand;
use Plugins\Jwsoft\TiptapEditor\Console\Commands\PruneMediaUploadSessionsCommand;
use Plugins\Jwsoft\TiptapEditor\Repositories\Contracts\ImageReferenceSourceRepositoryInterface;
use Plugins\Jwsoft\TiptapEditor\Repositories\Contracts\ImageUploadRepositoryInterface;
use Plugins\Jwsoft\TiptapEditor\Repositories\Contracts\MediaUploadRepositoryInterface;
use Plugins\Jwsoft\TiptapEditor\Repositories\ImageReferenceSourceRepository;
use Plugins\Jwsoft\TiptapEditor\Repositories\ImageUploadRepository;
use Plugins\Jwsoft\TiptapEditor\Repositories\MediaUploadRepository;
use Plugins\Jwsoft\TiptapEditor\Services\ImageCleanupService;
use Plugins\Jwsoft\TiptapEditor\Services\ImageServeService;
use Plugins\Jwsoft\TiptapEditor\Services\ImageUploadService;
use Plugins\Jwsoft\TiptapEditor\Services\MediaServeService;
use Plugins\Jwsoft\TiptapEditor\Services\MediaUploadService;
use Plugins\Jwsoft\TiptapEditor\Services\Contracts\SafeUrlResolverInterface;
use Plugins\Jwsoft\TiptapEditor\Services\DnsSafeUrlResolver;
use RuntimeException;

class JwsoftTiptapEditorServiceProvider extends BasePluginServiceProvider
{
    protected string $pluginIdentifier = 'jwsoft-tiptap-editor';

    protected array $repositories = [
        ImageUploadRepositoryInterface::class => ImageUploadRepository::class,
        ImageReferenceSourceRepositoryInterface::class => ImageReferenceSourceRepository::class,
        MediaUploadRepositoryInterface::class => MediaUploadRepository::class,
        SafeUrlResolverInterface::class => DnsSafeUrlResolver::class,
    ];

    protected array $storageServices = [ImageServeService::class, ImageCleanupService::class];

    protected array $storageCategoryServices = [
        ImageUploadService::class => 'images',
        MediaUploadService::class => 'media',
        MediaServeService::class => 'media',
    ];

    protected function loadExtensionTranslations(): void
    {
        // Resolve from this source, not the G7 namespace compatibility subclass.
        $this->loadTranslationsFrom(dirname(__DIR__, 2).'/lang', $this->pluginIdentifier);
    }

    public function boot(): void
    {
        parent::boot();
        HookManager::addAction(
            'core.plugins.before_activate',
            $this->guardConflictingEditorActivation(...),
            1,
        );
        HookManager::addAction(
            'core.plugins.activated',
            $this->rollbackConflictingEditorActivation(...),
            1,
        );
        if ($this->app->runningInConsole()) {
            $this->commands([PruneUnusedImagesCommand::class, PruneMediaUploadSessionsCommand::class]);
        }
    }

    public function guardConflictingEditorActivation(string $pluginIdentifier): void
    {
        if ($pluginIdentifier === 'sirsoft-ckeditor5' && $this->isActive()) {
            throw new RuntimeException(
                '현재 JWSoft Tiptap 에디터가 활성화되어 있습니다. 에디터는 하나만 활성화할 수 있습니다. 관리자 → 플러그인에서 JWSoft Tiptap 에디터를 먼저 비활성화한 뒤 CKEditor (sirsoft-ckeditor5)의 활성화를 다시 누르십시오. 기존 에디터는 자동으로 꺼지지 않았습니다.',
            );
        }
    }

    /**
     * G7 7.0.9의 plugin:activate CLI는 before_activate 훅을 거치지 않습니다.
     * CLI 경로에서도 두 replace-mode 에디터가 활성 상태로 남지 않도록 즉시 되돌립니다.
     */
    public function rollbackConflictingEditorActivation(string $pluginIdentifier): void
    {
        if ($pluginIdentifier !== 'sirsoft-ckeditor5' || ! $this->isActive()) {
            return;
        }

        $result = app(PluginManagerInterface::class)->deactivatePlugin($pluginIdentifier, true);
        if (! ($result['success'] ?? false)) {
            throw new RuntimeException(
                'sirsoft-ckeditor5 동시 활성화를 감지했지만 안전한 자동 롤백에 실패했습니다.',
            );
        }

        throw new RuntimeException(
            '현재 JWSoft Tiptap 에디터가 활성화되어 있어 CKEditor (sirsoft-ckeditor5)의 동시 활성화를 되돌렸습니다. 관리자 → 플러그인에서 JWSoft Tiptap 에디터를 먼저 비활성화한 뒤 CKEditor의 활성화를 다시 누르십시오.',
        );
    }

    private function isActive(): bool
    {
        return app(PluginRepositoryInterface::class)
            ->findActiveByIdentifier($this->pluginIdentifier) !== null;
    }
}
