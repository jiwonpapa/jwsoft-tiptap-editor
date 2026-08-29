<?php

namespace Plugins\Jwsoft\TiptapEditor\Services;

use App\Contracts\Extension\StorageInterface;
use App\Extension\HookManager;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Plugins\Jwsoft\TiptapEditor\Exceptions\ImageUploadException;
use Plugins\Jwsoft\TiptapEditor\Generated\EditorPolicy;
use Plugins\Jwsoft\TiptapEditor\Models\JwsoftTiptapImageUpload;
use Plugins\Jwsoft\TiptapEditor\Repositories\Contracts\ImageUploadRepositoryInterface;
use Plugins\Jwsoft\TiptapEditor\Support\ImageHookContract;
use Throwable;

class ImageUploadService
{
    public function __construct(
        private readonly ImageUploadRepositoryInterface $repository,
        private readonly StorageInterface $storage,
    ) {}

    public function upload(UploadedFile $file, ?int $uploadedBy, int $maxSizeMb): JwsoftTiptapImageUpload
    {
        HookManager::doAction(ImageHookContract::LEGACY_BEFORE_UPLOAD, $file, $uploadedBy);
        HookManager::doAction(ImageHookContract::BEFORE_UPLOAD, $file, $uploadedBy);

        $filtered = HookManager::applyFilters(ImageHookContract::LEGACY_FILTER_UPLOAD_FILE, $file);
        $filtered = HookManager::applyFilters(ImageHookContract::FILTER_UPLOAD_FILE, $filtered);
        if (! $filtered instanceof UploadedFile) {
            throw new ImageUploadException('image_filter_invalid');
        }
        $file = $filtered;

        $metadata = $this->validateTransformedFile($file, $maxSizeMb);
        $filename = Str::uuid().'.'.$metadata['extension'];
        $path = date('Y/m/d').'/'.$filename;
        $contents = file_get_contents($file->getRealPath());
        if (! is_string($contents) || ! $this->storage->put('images', $path, $contents)) {
            throw new ImageUploadException('image_storage_failed');
        }

        try {
            $record = $this->repository->create([
                'original_name' => $this->safeOriginalName($file->getClientOriginalName()),
                'file_path' => 'images/'.$path,
                'storage_disk' => $this->storage->getDisk(),
                'file_size' => $metadata['bytes'],
                'mime_type' => $metadata['mime'],
                'uploaded_by' => $uploadedBy,
            ]);
        } catch (Throwable $exception) {
            if (! $this->storage->delete('images', $path)) {
                Log::error('JWSoft Tiptap 업로드 레코드 실패 후 파일 회수 실패', [
                    'disk' => $this->storage->getDisk(),
                ]);
            }
            throw $exception;
        }

        foreach ([ImageHookContract::LEGACY_AFTER_UPLOAD, ImageHookContract::AFTER_UPLOAD] as $hook) {
            try {
                HookManager::doAction($hook, $record);
            } catch (Throwable) {
                Log::warning('JWSoft Tiptap 이미지 after_upload 소비자 실패', [
                    'image_id' => $record->id,
                    'hook' => $hook,
                ]);
            }
        }

        return $record;
    }

    /** @return array{mime: string, extension: string, bytes: int} */
    private function validateTransformedFile(UploadedFile $file, int $maxSizeMb): array
    {
        $path = $file->getRealPath();
        if (! is_string($path) || $path === '' || ! is_file($path)) {
            throw new ImageUploadException('image_file_missing');
        }

        $bytes = filesize($path);
        $policyMax = (int) EditorPolicy::POLICY['limits']['maxImageBytes'];
        $settingMax = max(1, min(10, $maxSizeMb)) * 1024 * 1024;
        if (! is_int($bytes) || $bytes < 1 || $bytes > min($policyMax, $settingMax)) {
            throw new ImageUploadException('image_size_rejected');
        }

        $mime = (new \finfo(FILEINFO_MIME_TYPE))->file($path);
        $extensions = [
            'image/jpeg' => 'jpg',
            'image/png' => 'png',
            'image/gif' => 'gif',
            'image/webp' => 'webp',
            'image/avif' => 'avif',
        ];
        $allowed = EditorPolicy::POLICY['media']['allowedMimeTypes'];
        if (! is_string($mime) || ! in_array($mime, $allowed, true) || ! isset($extensions[$mime])) {
            throw new ImageUploadException('image_mime_rejected');
        }

        $dimensions = @getimagesize($path);
        if (! is_array($dimensions) || ($dimensions[0] * $dimensions[1]) > (int) EditorPolicy::POLICY['limits']['maxImagePixels']) {
            throw new ImageUploadException('image_dimensions_rejected');
        }

        return ['mime' => $mime, 'extension' => $extensions[$mime], 'bytes' => $bytes];
    }

    private function safeOriginalName(string $name): string
    {
        $name = preg_replace('/[\x00-\x1F\x7F]/u', '', basename(str_replace('\\', '/', $name))) ?: 'image';

        return function_exists('mb_substr') ? mb_substr($name, 0, 255) : substr($name, 0, 255);
    }
}
