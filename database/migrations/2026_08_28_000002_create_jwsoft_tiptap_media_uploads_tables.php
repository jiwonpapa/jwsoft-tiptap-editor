<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('jwsoft_tiptap_media_uploads', function (Blueprint $table): void {
            $table->id();
            $table->string('hash', 12)->unique();
            $table->string('original_name');
            $table->string('file_path', 1000);
            $table->string('storage_disk', 50)->default('public');
            $table->unsignedBigInteger('file_size');
            $table->string('mime_type', 100)->default('video/mp4');
            $table->unsignedBigInteger('uploaded_by')->nullable()->index();
            $table->timestamps();
            $table->index('created_at', 'jwsoft_tiptap_media_created_at_index');
        });

        Schema::create('jwsoft_tiptap_media_upload_sessions', function (Blueprint $table): void {
            $table->id();
            $table->string('token', 32)->unique();
            $table->string('original_name');
            $table->unsignedBigInteger('file_size');
            $table->unsignedInteger('chunk_size');
            $table->unsignedInteger('total_parts');
            $table->json('received_parts')->nullable();
            $table->string('status', 20)->default('pending');
            $table->unsignedBigInteger('uploaded_by')->nullable()->index();
            $table->timestamp('expires_at')->index();
            $table->timestamps();
            $table->index(['status', 'expires_at'], 'jwsoft_tiptap_media_session_expiry_index');
        });

        if (DB::getDriverName() === 'mysql') {
            Schema::table('jwsoft_tiptap_media_uploads', function (Blueprint $table): void {
                $table->comment('JWSoft Tiptap 에디터 MP4 업로드 기록');
            });
            Schema::table('jwsoft_tiptap_media_upload_sessions', function (Blueprint $table): void {
                $table->comment('JWSoft Tiptap 에디터 MP4 청크 업로드 세션');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('jwsoft_tiptap_media_upload_sessions');
        Schema::dropIfExists('jwsoft_tiptap_media_uploads');
    }
};
