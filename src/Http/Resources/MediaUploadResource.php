<?php

namespace Plugins\Jwsoft\TiptapEditor\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

class MediaUploadResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'hash' => $this->hash,
            'original_name' => $this->original_name,
            'file_size' => $this->file_size,
            'mime_type' => $this->mime_type,
            'download_url' => $this->download_url,
            'created_at' => $this->created_at?->toISOString(),
        ];
    }
}
