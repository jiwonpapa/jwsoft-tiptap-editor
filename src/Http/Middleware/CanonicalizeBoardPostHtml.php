<?php

namespace Plugins\Jwsoft\TiptapEditor\Http\Middleware;

use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Plugins\Jwsoft\TiptapEditor\Exceptions\PolicyViolationException;
use Plugins\Jwsoft\TiptapEditor\Generated\EditorPolicy;
use Plugins\Jwsoft\TiptapEditor\Services\EditorSanitizer;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

final class CanonicalizeBoardPostHtml
{
    public function __construct(
        private readonly EditorSanitizer $sanitizer = new EditorSanitizer(),
    ) {}

    public function handle(Request $request, Closure $next): Response
    {
        if (! $request->exists('content')) {
            return $next($request);
        }

        $mode = $request->input('content_mode');
        if ($mode === null && in_array($request->getMethod(), ['PUT', 'PATCH'], true)) {
            return $this->validationError(
                'content_mode_required',
                '본문 수정 시 content_mode을 명시해야 합니다.',
            );
        }
        if ($mode !== 'html') {
            return $next($request);
        }

        $content = $request->input('content');
        if (! is_string($content)) {
            return $this->validationError(
                'invalid_html_content',
                'HTML 본문은 문자열이어야 합니다.',
            );
        }

        try {
            $result = $this->sanitizer->sanitize($content);
            if ($result->changed
                && $request->input('jwsoft_editor_policy_ack') !== EditorPolicy::SHA256) {
                return $this->validationError(
                    'canonical_confirmation_required',
                    '정제 과정에서 HTML이 변경됩니다. 편집기에서 변경 결과를 확인하십시오.',
                );
            }
            $request->merge(['content' => $result->canonicalHtml]);
        } catch (PolicyViolationException $exception) {
            return $this->validationError($exception->reasonCode, $exception->getMessage());
        } catch (Throwable) {
            return new JsonResponse([
                'success' => false,
                'code' => 'editor_policy_unavailable',
                'message' => 'HTML 저장 정책을 확인할 수 없어 저장을 차단했습니다.',
                'errors' => [
                    'content' => ['잠시 후 다시 시도하거나 관리자에게 문의하십시오.'],
                ],
            ], 503);
        }

        return $next($request);
    }

    private function validationError(string $code, string $message): JsonResponse
    {
        return new JsonResponse([
            'success' => false,
            'code' => $code,
            'message' => 'HTML 본문을 저장할 수 없습니다.',
            'errors' => [
                'content' => [$message],
            ],
        ], 422);
    }
}
