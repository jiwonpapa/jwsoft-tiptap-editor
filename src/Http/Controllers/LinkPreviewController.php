<?php

namespace Plugins\Jwsoft\TiptapEditor\Http\Controllers;

use App\Helpers\ResponseHelper;
use App\Http\Controllers\Api\Base\AdminBaseController;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;
use Plugins\Jwsoft\TiptapEditor\Exceptions\LinkPreviewException;
use Plugins\Jwsoft\TiptapEditor\Http\Requests\LinkPreviewRequest;
use Plugins\Jwsoft\TiptapEditor\Services\LinkPreviewService;
use Throwable;

class LinkPreviewController extends AdminBaseController
{
    public function __construct(private readonly LinkPreviewService $service)
    {
        parent::__construct();
    }

    public function preview(LinkPreviewRequest $request): JsonResponse
    {
        try {
            $preview = $this->service->preview((string) $request->validated('url'), [
                'social' => $this->enabled('socialCards', true),
                'generic' => $this->enabled('genericLinkCards', true),
                'images' => $this->enabled('smartCardImages', false),
                'embeds' => ['x' => $this->enabled('xEmbed', true), 'facebook' => $this->enabled('facebookEmbed', true)],
            ]);

            return ResponseHelper::success('messages.preview.created', $preview, domain: 'jwsoft-tiptap-editor');
        } catch (LinkPreviewException) {
            return ResponseHelper::error('messages.preview.rejected', 422, domain: 'jwsoft-tiptap-editor');
        } catch (Throwable $exception) {
            Log::error('JWSoft Tiptap 링크 미리보기 생성 실패', ['exception' => $exception::class]);

            return ResponseHelper::error('messages.preview.failed', 500, domain: 'jwsoft-tiptap-editor');
        }
    }

    private function enabled(string $key, bool $default): bool
    {
        return in_array(plugin_setting('jwsoft-tiptap-editor', $key, $default), [true, 1, '1'], true);
    }
}
