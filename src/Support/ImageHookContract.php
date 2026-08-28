<?php

namespace Plugins\Jwsoft\TiptapEditor\Support;

/**
 * 이미지 확장 훅 계약.
 *
 * LEGACY_* 별칭은 기존 sirsoft-ckeditor5 최적화·참조 소스 소비자가 플러그인
 * 교체 뒤에도 동작하도록 유지합니다. 소비자는 새 이름 또는 별칭 중 하나만 등록합니다.
 */
final class ImageHookContract
{
    public const BEFORE_UPLOAD = 'jwsoft-tiptap-editor.image.before_upload';
    public const FILTER_UPLOAD_FILE = 'jwsoft-tiptap-editor.image.filter_upload_file';
    public const AFTER_UPLOAD = 'jwsoft-tiptap-editor.image.after_upload';
    public const FILTER_REFERENCE_SOURCES = 'jwsoft-tiptap-editor.image.filter_reference_sources';

    public const LEGACY_BEFORE_UPLOAD = 'sirsoft-ckeditor5.image.before_upload';
    public const LEGACY_FILTER_UPLOAD_FILE = 'sirsoft-ckeditor5.image.filter_upload_file';
    public const LEGACY_AFTER_UPLOAD = 'sirsoft-ckeditor5.image.after_upload';
    public const LEGACY_FILTER_REFERENCE_SOURCES = 'sirsoft-ckeditor5.image.filter_reference_sources';
}
