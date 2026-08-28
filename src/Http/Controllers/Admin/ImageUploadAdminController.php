<?php

namespace Plugins\Jwsoft\TiptapEditor\Http\Controllers\Admin;

use App\Helpers\ResponseHelper;
use App\Http\Controllers\Api\Base\AdminBaseController;
use Illuminate\Http\JsonResponse;
use Plugins\Jwsoft\TiptapEditor\Http\Requests\BulkDeleteUploadsRequest;
use Plugins\Jwsoft\TiptapEditor\Http\Requests\IndexUploadsRequest;
use Plugins\Jwsoft\TiptapEditor\Http\Resources\ImageUploadResource;
use Plugins\Jwsoft\TiptapEditor\Services\ImageUploadAdminService;

class ImageUploadAdminController extends AdminBaseController
{
    public function __construct(private readonly ImageUploadAdminService $service)
    {
        parent::__construct();
    }

    public function index(IndexUploadsRequest $request): JsonResponse
    {
        $result = $this->service->paginate($request->filters(), $request->perPage(), $request->pageNumber());

        return ResponseHelper::success('common.success', [
            'data' => ImageUploadResource::collection($result['items']),
            'pagination' => $result['pagination'],
            'meta' => [
                'scan_limited' => $result['scan_limited'],
                'scan_window' => ImageUploadAdminService::SCAN_WINDOW,
                'reference_sources_incomplete' => $result['reference_sources_incomplete'],
            ],
        ]);
    }

    public function destroy(int $id): JsonResponse
    {
        $upload = $this->service->find($id);
        if ($upload === null) {
            return ResponseHelper::notFound('messages.uploads.not_found', domain: 'jwsoft-tiptap-editor');
        }
        if (! $this->service->delete($upload)) {
            return ResponseHelper::error('messages.uploads.delete_failed', 500, domain: 'jwsoft-tiptap-editor');
        }

        return ResponseHelper::success('messages.uploads.deleted', domain: 'jwsoft-tiptap-editor');
    }

    public function bulkDestroy(BulkDeleteUploadsRequest $request): JsonResponse
    {
        $result = $this->service->bulkDelete($request->ids());
        if ($result['failed'] > 0) {
            return ResponseHelper::error('messages.uploads.delete_failed', 500, $result, domain: 'jwsoft-tiptap-editor');
        }

        return ResponseHelper::success(
            'messages.uploads.bulk_deleted',
            $result,
            messageParams: ['deleted' => $result['deleted']],
            domain: 'jwsoft-tiptap-editor',
        );
    }
}
