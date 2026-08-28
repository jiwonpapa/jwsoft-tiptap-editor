<?php

namespace Plugins\Jwsoft\TiptapEditor\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class LinkPreviewRequest extends FormRequest
{
    public function authorize(): bool
    {
        return in_array(plugin_setting('jwsoft-tiptap-editor', 'smartCards', false), [true, 1, '1'], true);
    }

    public function rules(): array
    {
        return ['url' => ['required', 'string', 'max:2048']];
    }
}
