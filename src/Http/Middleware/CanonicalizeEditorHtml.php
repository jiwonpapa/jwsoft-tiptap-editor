<?php

namespace Plugins\Jwsoft\TiptapEditor\Http\Middleware;

use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use InvalidArgumentException;
use Plugins\Jwsoft\TiptapEditor\Exceptions\PolicyViolationException;
use Plugins\Jwsoft\TiptapEditor\Generated\EditorPolicy;
use Plugins\Jwsoft\TiptapEditor\Services\EditorSanitizer;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

class CanonicalizeEditorHtml
{
    /** @var array<string, string> */
    private const HTML_FIELDS = [
        'content' => 'content_mode',
        'description' => 'description_mode',
    ];

    public function __construct(
        private readonly EditorSanitizer $sanitizer = new EditorSanitizer(),
    ) {}

    public function handle(Request $request, Closure $next): Response
    {
        $canonicalFields = [];

        foreach (self::HTML_FIELDS as $field => $modeField) {
            if (! $request->exists($field)) {
                continue;
            }

            $mode = $request->input($modeField);
            if ($mode === null) {
                return $this->validationError(
                    $field,
                    $modeField.'_required',
                    "{$field} 저장 시 {$modeField}을 명시해야 합니다.",
                );
            }
            if ($mode !== 'html') {
                continue;
            }

            try {
                [$canonicalValue, $changed] = $this->canonicalizeValue($request->input($field));
                if ($changed
                    && $request->input('jwsoft_editor_policy_ack') !== EditorPolicy::SHA256) {
                    return $this->validationError(
                        $field,
                        'canonical_confirmation_required',
                        '정제 과정에서 HTML이 변경됩니다. 편집기에서 변경 결과를 확인하십시오.',
                    );
                }
                $canonicalFields[$field] = $canonicalValue;
            } catch (InvalidArgumentException) {
                return $this->validationError(
                    $field,
                    'invalid_html_'.$field,
                    'HTML 값은 문자열 또는 언어별 문자열 map이어야 합니다.',
                );
            } catch (PolicyViolationException $exception) {
                return $this->validationError($field, $exception->reasonCode, $exception->getMessage());
            } catch (Throwable) {
                return new JsonResponse([
                    'success' => false,
                    'code' => 'editor_policy_unavailable',
                    'message' => 'HTML 저장 정책을 확인할 수 없어 저장을 차단했습니다.',
                    'errors' => [
                        $field => ['잠시 후 다시 시도하거나 관리자에게 문의하십시오.'],
                    ],
                ], 503);
            }
        }

        if ($canonicalFields !== []) {
            $request->merge($canonicalFields);
        }

        return $next($request);
    }

    /**
     * @return array{0: string|array<array-key, string|null>|null, 1: bool}
     */
    private function canonicalizeValue(mixed $value): array
    {
        if ($value === null) {
            return [null, false];
        }

        if (is_string($value)) {
            $result = $this->sanitizer->sanitize($value);

            return [$result->canonicalHtml, $result->changed];
        }

        if (! is_array($value)) {
            throw new InvalidArgumentException('HTML value type is invalid.');
        }

        $canonicalValue = [];
        $changed = false;
        foreach ($value as $locale => $html) {
            if ($html === null) {
                $canonicalValue[$locale] = null;

                continue;
            }
            if (! is_string($html)) {
                throw new InvalidArgumentException('Localized HTML value type is invalid.');
            }

            $result = $this->sanitizer->sanitize($html);
            $canonicalValue[$locale] = $result->canonicalHtml;
            $changed = $changed || $result->changed;
        }

        return [$canonicalValue, $changed];
    }

    private function validationError(string $field, string $code, string $message): JsonResponse
    {
        return new JsonResponse([
            'success' => false,
            'code' => $code,
            'message' => 'HTML 콘텐츠를 저장할 수 없습니다.',
            'errors' => [
                $field => [$message],
            ],
        ], 422);
    }
}
