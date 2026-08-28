<?php

namespace Plugins\Jwsoft\TiptapEditor\Models;

use App\Contracts\Extension\StorageInterface;
use App\Extension\Storage\PluginStorageDriver;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class JwsoftTiptapMediaUpload extends Model
{
    protected $table = 'jwsoft_tiptap_media_uploads';

    protected $fillable = [
        'hash',
        'original_name',
        'file_path',
        'storage_disk',
        'file_size',
        'mime_type',
        'uploaded_by',
    ];

    /** @var array<string, StorageInterface> */
    private static array $storageByDisk = [];

    protected static function boot(): void
    {
        parent::boot();
        static::creating(function (self $model): void {
            $model->hash = $model->hash ?: self::generateHash();
        });
    }

    public static function generateHash(): string
    {
        do {
            $hash = bin2hex(random_bytes(6));
        } while (self::query()->where('hash', $hash)->exists());

        return $hash;
    }

    public function getDownloadUrlAttribute(): string
    {
        $disk = (string) ($this->storage_disk ?? '');
        $path = (string) ($this->file_path ?? '');
        if ($disk !== '' && str_contains($path, '/')) {
            [$category, $relative] = explode('/', $path, 2);
            if ($category !== '' && $relative !== '') {
                $storage = self::$storageByDisk[$disk]
                    ??= new PluginStorageDriver('jwsoft-tiptap-editor', $disk);
                $url = $storage->url($category, $relative);
                if (is_string($url) && $url !== '') {
                    return $url;
                }
            }
        }

        return '/api/plugins/jwsoft-tiptap-editor/media/'.$this->hash;
    }

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }
}
