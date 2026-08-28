<?php

namespace Plugins\Jwsoft\TiptapEditor\Http\Controllers;

use App\Helpers\ResponseHelper;
use App\Http\Controllers\Api\Base\AdminBaseController;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;
use Plugins\Jwsoft\TiptapEditor\Exceptions\ImageUploadException;
use Plugins\Jwsoft\TiptapEditor\Http\Requests\ImageUploadRequest;
use Plugins\Jwsoft\TiptapEditor\Http\Resources\ImageUploadResource;
use Plugins\Jwsoft\TiptapEditor\Services\ImageUploadService;
use Throwable;

class ImageUploadController extends AdminBaseController
{
    public function __construct(private readonly ImageUploadService $service)
    {
        parent::__construct();
    }

    public function upload(ImageUploadRequest $request): JsonResponse
    {
        try {
            $image = $this->service->upload(
                $request->file('upload'),
                $this->getCurrentUser()?->id,
                $request->maxSizeMb(),
            );

            return ResponseHelper::success(
                'messages.upload.created',
                (new ImageUploadResource($image))->resolve(),
                201,
                domain: 'jwsoft-tiptap-editor',
            );
        } catch (ImageUploadException) {
            return ResponseHelper::error('messages.upload.rejected', 422, domain: 'jwsoft-tiptap-editor');
        } catch (Throwable $exception) {
            Log::error('JWSoft Tiptap 이미지 업로드 실패', ['exception' => $exception::class]);

            return ResponseHelper::error('messages.upload.failed', 500, domain: 'jwsoft-tiptap-editor');
        }
    }
}
