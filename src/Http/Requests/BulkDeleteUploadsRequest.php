<?php

namespace Plugins\Jwsoft\TiptapEditor\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Plugins\Jwsoft\TiptapEditor\Models\JwsoftTiptapImageUpload;

class BulkDeleteUploadsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'ids' => ['required', 'array', 'min:1', 'max:100'],
            'ids.*' => ['integer', Rule::exists(JwsoftTiptapImageUpload::class, 'id')],
        ];
    }

    /** @return list<int> */
    public function ids(): array
    {
        return array_values(array_unique(array_map('intval', $this->validated('ids') ?? [])));
    }
}
