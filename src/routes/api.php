<?php

use Illuminate\Support\Facades\Route;
use Plugins\Jwsoft\TiptapEditor\Http\Controllers\Admin\ImageUploadAdminController;
use Plugins\Jwsoft\TiptapEditor\Http\Controllers\ImageServeController;
use Plugins\Jwsoft\TiptapEditor\Http\Controllers\ImageUploadController;

Route::post('upload', [ImageUploadController::class, 'upload'])
    ->name('api.jwsoft-tiptap-editor.upload');

Route::get('images/{hash}', [ImageServeController::class, 'serve'])
    ->where('hash', '[a-f0-9]{12}')
    ->name('api.jwsoft-tiptap-editor.images.serve');

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
