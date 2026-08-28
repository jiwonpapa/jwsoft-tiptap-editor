<?php

namespace Plugins\Jwsoft\TiptapEditor\Http\Controllers;

use App\Helpers\ResponseHelper;
use App\Http\Controllers\Api\Base\PublicBaseController;
use Illuminate\Http\JsonResponse;
use Plugins\Jwsoft\TiptapEditor\Services\ImageServeService;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ImageServeController extends PublicBaseController
{
    public function __construct(private readonly ImageServeService $service) {}

    public function serve(string $hash): StreamedResponse|JsonResponse
    {
        $image = $this->service->findByHash($hash);
        if ($image === null || ($response = $this->service->serve($image)) === null) {
            return ResponseHelper::notFound('messages.image.not_found', domain: 'jwsoft-tiptap-editor');
        }

        return $response;
    }
}
