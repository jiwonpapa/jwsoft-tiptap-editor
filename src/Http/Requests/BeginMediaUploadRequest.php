<?php

namespace Plugins\Jwsoft\TiptapEditor\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class BeginMediaUploadRequest extends FormRequest
{
    public function authorize(): bool
    {
        return in_array(plugin_setting('jwsoft-tiptap-editor', 'videoUpload', false), [true, 1, '1'], true);
    }

    public function rules(): array
    {
        return [
            'original_name' => ['required', 'string', 'max:255', 'regex:/\.mp4$/i'],
            'file_size' => ['required', 'integer', 'min:8', 'max:'.($this->maxSizeMb() * 1024 * 1024)],
        ];
    }

    public function maxSizeMb(): int
    {
        return max(1, min(500, (int) plugin_setting('jwsoft-tiptap-editor', 'videoMaxSizeMb', 200)));
    }

    public function chunkSizeMb(): int
    {
        return max(1, min(10, (int) plugin_setting('jwsoft-tiptap-editor', 'videoChunkSizeMb', 5)));
    }
}
