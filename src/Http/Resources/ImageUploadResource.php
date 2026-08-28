<?php

namespace Plugins\Jwsoft\TiptapEditor\Http\Resources;

use App\Http\Resources\BaseApiResource;
use Illuminate\Http\Request;

class ImageUploadResource extends BaseApiResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => (int) $this->id,
            'hash' => (string) $this->hash,
            'original_name' => (string) $this->original_name,
            'file_size' => (int) $this->file_size,
            'mime_type' => (string) $this->mime_type,
            'uploaded_by' => $this->uploaded_by,
            'uploader_name' => $this->relationLoaded('uploader') ? $this->uploader?->name : null,
            'created_at' => $this->formatDateTimeStringForUser($this->created_at),
            'download_url' => $this->download_url,
            'referenced' => (bool) ($this->referenced ?? true),
        ];
    }
}
