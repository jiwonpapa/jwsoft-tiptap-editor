<?php

namespace Plugins\Jwsoft\TiptapEditor\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class MediaUploadPartRequest extends FormRequest
{
    public function authorize(): bool
    {
        return in_array(plugin_setting('jwsoft-tiptap-editor', 'videoUpload', false), [true, 1, '1'], true);
    }

    public function rules(): array
    {
        return [
            'chunk' => ['required', 'file', 'max:10240'],
            'checksum' => ['required', 'string', 'regex:/^[a-f0-9]{64}$/'],
        ];
    }
}
