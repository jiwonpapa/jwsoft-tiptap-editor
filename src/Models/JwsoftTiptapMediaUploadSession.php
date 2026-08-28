<?php

namespace Plugins\Jwsoft\TiptapEditor\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

class JwsoftTiptapMediaUploadSession extends Model
{
    protected $table = 'jwsoft_tiptap_media_upload_sessions';

    protected $dateFormat = 'Y-m-d H:i:s';

    protected $fillable = [
        'token',
        'original_name',
        'file_size',
        'chunk_size',
        'total_parts',
        'received_parts',
        'status',
        'uploaded_by',
        'expires_at',
    ];

    protected $casts = [
        'file_size' => 'integer',
        'chunk_size' => 'integer',
        'total_parts' => 'integer',
        'received_parts' => 'array',
        'uploaded_by' => 'integer',
        'expires_at' => 'datetime',
    ];

    public function isExpired(): bool
    {
        return $this->expires_at instanceof Carbon && $this->expires_at->isPast();
    }

}
