<?php

namespace Plugins\Jwsoft\TiptapEditor\Providers;

use App\Extension\BasePluginServiceProvider;
use Plugins\Jwsoft\TiptapEditor\Console\Commands\PruneUnusedImagesCommand;
use Plugins\Jwsoft\TiptapEditor\Repositories\Contracts\ImageReferenceSourceRepositoryInterface;
use Plugins\Jwsoft\TiptapEditor\Repositories\Contracts\ImageUploadRepositoryInterface;
use Plugins\Jwsoft\TiptapEditor\Repositories\ImageReferenceSourceRepository;
use Plugins\Jwsoft\TiptapEditor\Repositories\ImageUploadRepository;
use Plugins\Jwsoft\TiptapEditor\Services\ImageCleanupService;
use Plugins\Jwsoft\TiptapEditor\Services\ImageServeService;
use Plugins\Jwsoft\TiptapEditor\Services\ImageUploadService;

class JwsoftTiptapEditorServiceProvider extends BasePluginServiceProvider
{
    protected string $pluginIdentifier = 'jwsoft-tiptap-editor';

    protected array $repositories = [
        ImageUploadRepositoryInterface::class => ImageUploadRepository::class,
        ImageReferenceSourceRepositoryInterface::class => ImageReferenceSourceRepository::class,
    ];

    protected array $storageServices = [ImageServeService::class, ImageCleanupService::class];

    protected array $storageCategoryServices = [ImageUploadService::class => 'images'];

    public function boot(): void
    {
        parent::boot();
        if ($this->app->runningInConsole()) {
            $this->commands([PruneUnusedImagesCommand::class]);
        }
    }
}
