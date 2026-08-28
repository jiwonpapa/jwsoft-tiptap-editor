<?php

namespace Plugins\Jwsoft\TiptapEditor\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class MediaUploadSessionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return in_array(plugin_setting('jwsoft-tiptap-editor', 'videoUpload', false), [true, 1, '1'], true);
    }

    public function rules(): array
    {
        return [];
    }
}
