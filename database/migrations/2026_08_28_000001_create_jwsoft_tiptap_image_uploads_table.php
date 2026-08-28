<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('jwsoft_tiptap_image_uploads', function (Blueprint $table): void {
            $table->id();
            $table->string('hash', 12)->unique();
            $table->string('original_name');
            $table->string('file_path', 1000);
            $table->string('storage_disk', 50)->default('public');
            $table->unsignedBigInteger('file_size');
            $table->string('mime_type', 100);
            $table->unsignedBigInteger('uploaded_by')->nullable()->index();
            $table->timestamps();
            $table->index('created_at', 'jwsoft_tiptap_uploads_created_at_index');
        });

        if (DB::getDriverName() === 'mysql') {
            Schema::table('jwsoft_tiptap_image_uploads', function (Blueprint $table): void {
                $table->comment('JWSoft Tiptap 에디터 이미지 업로드 기록');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('jwsoft_tiptap_image_uploads');
    }
};
