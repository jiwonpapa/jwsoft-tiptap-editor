<?php

use Illuminate\Support\Facades\Route;
use Plugins\Jwsoft\TiptapEditor\Http\Controllers\Admin\ImageUploadAdminController;
use Plugins\Jwsoft\TiptapEditor\Http\Controllers\ImageServeController;
use Plugins\Jwsoft\TiptapEditor\Http\Controllers\ImageUploadController;
use Plugins\Jwsoft\TiptapEditor\Http\Controllers\LinkPreviewController;
use Plugins\Jwsoft\TiptapEditor\Http\Controllers\MediaServeController;
use Plugins\Jwsoft\TiptapEditor\Http\Controllers\MediaUploadController;

Route::post('upload', [ImageUploadController::class, 'upload'])
    ->name('api.jwsoft-tiptap-editor.upload');

Route::post('link-preview', [LinkPreviewController::class, 'preview'])
    ->middleware('throttle:10,1,jwsoft-link-preview:')
    ->name('api.jwsoft-tiptap-editor.link-preview');

Route::get('images/{hash}', [ImageServeController::class, 'serve'])
    ->where('hash', '[a-f0-9]{12}')
    ->name('api.jwsoft-tiptap-editor.images.serve');

Route::post('media/uploads', [MediaUploadController::class, 'begin'])
    ->name('api.jwsoft-tiptap-editor.media.uploads.begin');
Route::get('media/uploads/{token}', [MediaUploadController::class, 'status'])
    ->where('token', '[a-f0-9]{32}')
    ->name('api.jwsoft-tiptap-editor.media.uploads.status');
Route::put('media/uploads/{token}/parts/{part}', [MediaUploadController::class, 'part'])
    ->where('token', '[a-f0-9]{32}')
    ->whereNumber('part')
    ->name('api.jwsoft-tiptap-editor.media.uploads.part');
Route::post('media/uploads/{token}/complete', [MediaUploadController::class, 'complete'])
    ->where('token', '[a-f0-9]{32}')
    ->name('api.jwsoft-tiptap-editor.media.uploads.complete');
Route::delete('media/uploads/{token}', [MediaUploadController::class, 'cancel'])
    ->where('token', '[a-f0-9]{32}')
    ->name('api.jwsoft-tiptap-editor.media.uploads.cancel');
Route::get('media/{hash}', [MediaServeController::class, 'serve'])
    ->where('hash', '[a-f0-9]{12}')
    ->name('api.jwsoft-tiptap-editor.media.serve');

Route::prefix('admin')->name('admin.')->middleware('auth:sanctum')->group(function (): void {
    Route::get('uploads', [ImageUploadAdminController::class, 'index'])
        ->middleware('permission:admin,jwsoft-tiptap-editor.uploads.read')
        ->name('uploads.index');
    Route::post('uploads/bulk-delete', [ImageUploadAdminController::class, 'bulkDestroy'])
        ->middleware('permission:admin,jwsoft-tiptap-editor.uploads.delete')
        ->name('uploads.bulk-delete');
    Route::delete('uploads/{id}', [ImageUploadAdminController::class, 'destroy'])
        ->whereNumber('id')
        ->middleware('permission:admin,jwsoft-tiptap-editor.uploads.delete')
        ->name('uploads.destroy');
});
