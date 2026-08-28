<?php

namespace Plugins\Jwsoft\TiptapEditor\Http\Controllers;

use App\Helpers\ResponseHelper;
use App\Http\Controllers\Api\Base\PublicBaseController;
use Illuminate\Http\JsonResponse;
use Plugins\Jwsoft\TiptapEditor\Services\MediaServeService;
use Symfony\Component\HttpFoundation\StreamedResponse;

class MediaServeController extends PublicBaseController
{
    public function __construct(private readonly MediaServeService $service) {}

    public function serve(string $hash): StreamedResponse|JsonResponse
    {
        $media = $this->service->findByHash($hash);
        if ($media === null || ($response = $this->service->serve($media)) === null) {
            return ResponseHelper::notFound('messages.media.not_found', domain: 'jwsoft-tiptap-editor');
        }

        return $response;
    }
}
