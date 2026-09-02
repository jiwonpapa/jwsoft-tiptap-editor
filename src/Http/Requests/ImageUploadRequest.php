<?php

namespace Plugins\Jwsoft\TiptapEditor\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ImageUploadRequest extends FormRequest
{
    public function authorize(): bool
    {
        return (bool) plugin_setting('jwsoft-tiptap-editor', 'imageUpload', true);
    }

    public function rules(): array
    {
        $maxMb = $this->maxSizeMb();

        return [
            'upload' => [
                'required',
                'file',
                'mimetypes:image/jpeg,image/png,image/gif,image/webp,image/avif',
                'max:'.($maxMb * 1024),
            ],
        ];
    }

    public function messages(): array
    {
        return [
            'upload.required' => __('jwsoft-tiptap-editor::messages.upload.required'),
            'upload.file' => __('jwsoft-tiptap-editor::messages.upload.invalid'),
            'upload.mimetypes' => __('jwsoft-tiptap-editor::messages.upload.invalid'),
            'upload.max' => __('jwsoft-tiptap-editor::messages.upload.too_large', ['max' => $this->maxSizeMb()]),
        ];
    }

    public function maxSizeMb(): int
    {
        return max(1, min(10, (int) plugin_setting('jwsoft-tiptap-editor', 'imageMaxSizeMb', 2)));
    }
}
