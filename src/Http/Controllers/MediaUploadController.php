<?php

namespace Plugins\Jwsoft\TiptapEditor\Http\Controllers;

use App\Helpers\ResponseHelper;
use App\Http\Controllers\Api\Base\AdminBaseController;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;
use Plugins\Jwsoft\TiptapEditor\Exceptions\MediaUploadException;
use Plugins\Jwsoft\TiptapEditor\Http\Requests\BeginMediaUploadRequest;
use Plugins\Jwsoft\TiptapEditor\Http\Requests\MediaUploadPartRequest;
use Plugins\Jwsoft\TiptapEditor\Http\Requests\MediaUploadSessionRequest;
use Plugins\Jwsoft\TiptapEditor\Http\Resources\MediaUploadResource;
use Plugins\Jwsoft\TiptapEditor\Models\JwsoftTiptapMediaUploadSession;
use Plugins\Jwsoft\TiptapEditor\Services\MediaUploadService;
use Throwable;

class MediaUploadController extends AdminBaseController
{
    public function __construct(private readonly MediaUploadService $service)
    {
        parent::__construct();
    }

    public function begin(BeginMediaUploadRequest $request): JsonResponse
    {
        try {
            $session = $this->service->begin(
                (string) $request->validated('original_name'),
                (int) $request->validated('file_size'),
                $this->getCurrentUser()?->id,
                $request->maxSizeMb(),
                $request->chunkSizeMb(),
            );

            return ResponseHelper::success('messages.media.session_created', $this->sessionData($session), 201, domain: 'jwsoft-tiptap-editor');
        } catch (MediaUploadException) {
            return ResponseHelper::error('messages.media.rejected', 422, domain: 'jwsoft-tiptap-editor');
        } catch (Throwable $exception) {
            Log::error('JWSoft Tiptap MP4 업로드 세션 생성 실패', ['exception' => $exception::class]);

            return ResponseHelper::error('messages.media.failed', 500, domain: 'jwsoft-tiptap-editor');
        }
    }

    public function status(MediaUploadSessionRequest $request, string $token): JsonResponse
    {
        try {
            $session = $this->service->status($token, $this->getCurrentUser()?->id);

            return ResponseHelper::success('messages.media.session_status', $this->sessionData($session), domain: 'jwsoft-tiptap-editor');
        } catch (MediaUploadException) {
            return ResponseHelper::notFound('messages.media.session_not_found', domain: 'jwsoft-tiptap-editor');
        }
    }

    public function part(MediaUploadPartRequest $request, string $token, int $part): JsonResponse
    {
        try {
            $session = $this->service->storePart(
                $token,
                $part,
                $request->file('chunk'),
                (string) $request->validated('checksum'),
                $this->getCurrentUser()?->id,
            );

            return ResponseHelper::success('messages.media.part_received', $this->sessionData($session), domain: 'jwsoft-tiptap-editor');
        } catch (MediaUploadException) {
            return ResponseHelper::error('messages.media.part_rejected', 422, domain: 'jwsoft-tiptap-editor');
        } catch (Throwable $exception) {
            Log::error('JWSoft Tiptap MP4 청크 저장 실패', ['exception' => $exception::class]);

            return ResponseHelper::error('messages.media.failed', 500, domain: 'jwsoft-tiptap-editor');
        }
    }

    public function complete(MediaUploadSessionRequest $request, string $token): JsonResponse
    {
        try {
            $media = $this->service->complete($token, $this->getCurrentUser()?->id);

            return ResponseHelper::success(
                'messages.media.created',
                (new MediaUploadResource($media))->resolve(),
                201,
                domain: 'jwsoft-tiptap-editor',
            );
        } catch (MediaUploadException) {
            return ResponseHelper::error('messages.media.rejected', 422, domain: 'jwsoft-tiptap-editor');
        } catch (Throwable $exception) {
            Log::error('JWSoft Tiptap MP4 조립 실패', ['exception' => $exception::class]);

            return ResponseHelper::error('messages.media.failed', 500, domain: 'jwsoft-tiptap-editor');
        }
    }

    public function cancel(MediaUploadSessionRequest $request, string $token): JsonResponse
    {
        try {
            $this->service->cancel($token, $this->getCurrentUser()?->id);

            return ResponseHelper::success('messages.media.cancelled', domain: 'jwsoft-tiptap-editor');
        } catch (MediaUploadException) {
            return ResponseHelper::error('messages.media.cancel_failed', 422, domain: 'jwsoft-tiptap-editor');
        }
    }

    /** @return array<string, mixed> */
    private function sessionData(JwsoftTiptapMediaUploadSession $session): array
    {
        $received = array_map('intval', array_keys(is_array($session->received_parts) ? $session->received_parts : []));
        sort($received);

        return [
            'upload_token' => $session->token,
            'chunk_size' => $session->chunk_size,
            'total_parts' => $session->total_parts,
            'received_parts' => $received,
            'expires_at' => $session->expires_at?->toISOString(),
        ];
    }
}
