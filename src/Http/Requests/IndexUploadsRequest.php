<?php

namespace Plugins\Jwsoft\TiptapEditor\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class IndexUploadsRequest extends FormRequest
{
    public const DEFAULT_PER_PAGE = 20;
    public const MAX_PER_PAGE = 100;

    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $empty = [];
        foreach (['search', 'referenced', 'date_from', 'date_to', 'sort_by', 'sort_order', 'per_page', 'page'] as $key) {
            if ($this->has($key) && $this->input($key) === '') {
                $empty[$key] = null;
            }
        }
        $this->merge($empty);
    }

    public function rules(): array
    {
        return [
            'search' => ['nullable', 'string', 'max:255'],
            'referenced' => ['nullable', Rule::in(['all', 'referenced', 'unreferenced'])],
            'date_from' => ['nullable', 'date'],
            'date_to' => ['nullable', 'date'],
            'sort_by' => ['nullable', Rule::in(['created_at', 'file_size', 'original_name'])],
            'sort_order' => ['nullable', Rule::in(['asc', 'desc'])],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:'.self::MAX_PER_PAGE],
        ];
    }

    public function filters(): array
    {
        return [
            'search' => $this->validated('search'),
            'referenced' => $this->validated('referenced') ?? 'all',
            'date_from' => $this->validated('date_from'),
            'date_to' => $this->validated('date_to'),
            'sort_by' => $this->validated('sort_by'),
            'sort_order' => $this->validated('sort_order'),
        ];
    }

    public function perPage(): int
    {
        return (int) ($this->validated('per_page') ?? self::DEFAULT_PER_PAGE);
    }

    public function pageNumber(): int
    {
        return (int) ($this->validated('page') ?? 1);
    }
}
