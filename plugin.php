<?php

namespace Plugins\Jwsoft\TiptapEditor;

use App\Contracts\Extension\PluginManagerInterface;
use App\Enums\ExtensionOwnerType;
use App\Extension\AbstractPlugin;
use App\Extension\Helpers\ExtensionMenuSyncHelper;
use Throwable;

/**
 * G7 editor replacement plugin.
 */
if (class_exists(Plugin::class, false)) {
    return;
}

class Plugin extends AbstractPlugin
{
    private const LEGACY_CONTENT_RISK_SETTING = 'legacyContentRiskAcknowledged';

    private const CONFLICTING_PLUGINS = [
        'sirsoft-ckeditor5',
    ];

    public function getSettingsSchema(): array
    {
        return [
            self::LEGACY_CONTENT_RISK_SETTING => [
                'type' => 'boolean',
                'default' => false,
                'label' => ['ko' => '기존 콘텐츠 전환 위험 확인', 'en' => 'Acknowledge legacy content risk'],
                'hint' => [
                    'ko' => '기존 CKEditor의 inline style·전용 class·HTML 구조는 편집·저장 시 달라질 수 있고 자동 변환되지 않습니다. 문제가 생기면 JWSoft를 비활성화하고 CKEditor를 다시 활성화하십시오. 이 항목을 켜야 JWSoft를 활성화할 수 있습니다.',
                    'en' => 'Legacy CKEditor inline styles, custom classes, and HTML structure may change during editing or saving and are not migrated automatically. If problems occur, deactivate JWSoft and reactivate CKEditor. You must enable this acknowledgement before activation.',
                ],
                'required' => false,
            ],
            'imageUpload' => [
                'type' => 'boolean',
                'default' => true,
                'label' => ['ko' => '이미지 업로드', 'en' => 'Image upload'],
                'hint' => ['ko' => '에디터에서 서버 이미지 업로드를 허용합니다.', 'en' => 'Allow server image uploads from the editor.'],
                'required' => false,
            ],
            'dragDropImageUpload' => [
                'type' => 'boolean',
                'default' => true,
                'label' => ['ko' => '이미지 드래그·드롭 업로드', 'en' => 'Drag-and-drop image upload'],
                'hint' => ['ko' => '이미지 파일을 편집 위치에 놓으면 서버에 업로드한 뒤 삽입합니다.', 'en' => 'Upload and insert image files dropped at an editor position.'],
                'required' => false,
            ],
            'pasteImageUpload' => [
                'type' => 'boolean',
                'default' => true,
                'label' => ['ko' => '클립보드 이미지 업로드', 'en' => 'Clipboard image upload'],
                'hint' => ['ko' => '클립보드의 이미지 파일을 서버에 업로드한 뒤 삽입합니다.', 'en' => 'Upload and insert image files from the clipboard.'],
                'required' => false,
            ],
            'mediaEmbed' => [
                'type' => 'boolean',
                'default' => false,
                'label' => ['ko' => '동영상 플레이어 삽입', 'en' => 'Video player embeds'],
                'hint' => ['ko' => 'YouTube·Vimeo·MP4 URL을 반응형 플레이어로 삽입합니다. 기존 콘텐츠는 변경하지 않습니다.', 'en' => 'Insert YouTube, Vimeo, and MP4 URLs as responsive players without rewriting existing content.'],
                'required' => false,
            ],
            'autoEmbedUrls' => [
                'type' => 'boolean',
                'default' => false,
                'label' => ['ko' => '동영상 URL 자동 변환', 'en' => 'Auto-convert video URLs'],
                'hint' => ['ko' => '빈 문단에 지원 URL을 붙여넣으면 미디어 노드로 변환합니다.', 'en' => 'Convert a supported URL pasted into an empty paragraph into a media node.'],
                'required' => false,
            ],
            'youtubeEmbed' => [
                'type' => 'boolean',
                'default' => true,
                'label' => ['ko' => 'YouTube 허용', 'en' => 'Allow YouTube'],
                'hint' => ['ko' => 'YouTube 및 Shorts URL 삽입을 허용합니다.', 'en' => 'Allow YouTube and Shorts URLs.'],
                'required' => false,
            ],
            'vimeoEmbed' => [
                'type' => 'boolean',
                'default' => true,
                'label' => ['ko' => 'Vimeo 허용', 'en' => 'Allow Vimeo'],
                'hint' => ['ko' => 'Vimeo 동영상 URL 삽입을 허용합니다.', 'en' => 'Allow Vimeo video URLs.'],
                'required' => false,
            ],
            'mp4Embed' => [
                'type' => 'boolean',
                'default' => true,
                'label' => ['ko' => 'MP4 URL 허용', 'en' => 'Allow MP4 URLs'],
                'hint' => ['ko' => 'HTTPS 또는 플러그인 내부 MP4 URL을 플레이어로 삽입합니다.', 'en' => 'Allow HTTPS or plugin-owned MP4 URLs.'],
                'required' => false,
            ],
            'videoUpload' => [
                'type' => 'boolean',
                'default' => false,
                'label' => ['ko' => '동영상 파일 업로드', 'en' => 'Video file upload'],
                'hint' => ['ko' => 'MP4 파일을 청크 단위로 업로드하고 반응형 플레이어로 삽입합니다.', 'en' => 'Upload MP4 files in chunks and insert a responsive player.'],
                'required' => false,
            ],
            'videoMaxSizeMb' => [
                'type' => 'integer',
                'min' => 1,
                'max' => 500,
                'default' => 200,
                'label' => ['ko' => '동영상 최대 크기 (MB)', 'en' => 'Video max size (MB)'],
                'hint' => ['ko' => 'MP4 파일당 최대 업로드 크기입니다.', 'en' => 'Maximum upload size per MP4 file.'],
                'required' => false,
            ],
            'videoChunkSizeMb' => [
                'type' => 'integer',
                'min' => 1,
                'max' => 10,
                'default' => 5,
                'label' => ['ko' => '동영상 청크 크기 (MB)', 'en' => 'Video chunk size (MB)'],
                'hint' => ['ko' => '불안정한 연결에서 재시도할 업로드 조각 크기입니다.', 'en' => 'Chunk size retried on unstable connections.'],
                'required' => false,
            ],
            'mediaAutoplay' => [
                'type' => 'boolean',
                'default' => false,
                'label' => ['ko' => '동영상 자동재생 허용', 'en' => 'Allow video autoplay'],
                'hint' => ['ko' => '기본 꺼짐입니다. 켜도 브라우저 정책에 따라 음소거 자동재생만 동작할 수 있습니다.', 'en' => 'Off by default. Browsers may still allow muted autoplay only.'],
                'required' => false,
            ],
            'externalMediaLoadMode' => [
                'type' => 'enum',
                'options' => ['click', 'immediate'],
                'default' => 'click',
                'label' => ['ko' => '외부 플레이어 로드', 'en' => 'External player loading'],
                'hint' => ['ko' => '클릭 후 로드를 권장합니다. 즉시 로드는 페이지 표시와 함께 외부 제공자에 연결합니다.', 'en' => 'Click-to-load is recommended. Immediate mode connects to providers when content renders.'],
                'required' => false,
            ],
            'smartCards' => [
                'type' => 'boolean',
                'default' => false,
                'label' => ['ko' => '링크 스마트카드', 'en' => 'Link smart cards'],
                'hint' => ['ko' => 'SNS·일반 HTTPS URL의 제목과 설명을 안전한 링크 카드로 삽입합니다.', 'en' => 'Insert titles and descriptions from social and general HTTPS URLs as safe link cards.'],
                'required' => false,
            ],
            'autoSmartCards' => [
                'type' => 'boolean',
                'default' => false,
                'label' => ['ko' => 'URL 스마트카드 자동 변환', 'en' => 'Auto-convert URLs to smart cards'],
                'hint' => ['ko' => '빈 문단에 URL을 붙여넣으면 링크 미리보기를 가져와 카드로 변환합니다.', 'en' => 'Fetch a preview and convert a URL pasted into an empty paragraph.'],
                'required' => false,
            ],
            'socialCards' => [
                'type' => 'boolean',
                'default' => true,
                'label' => ['ko' => 'SNS 스마트카드', 'en' => 'Social smart cards'],
                'hint' => ['ko' => 'Instagram·X·TikTok·Facebook·Threads 링크 카드를 허용합니다.', 'en' => 'Allow cards for Instagram, X, TikTok, Facebook, and Threads links.'],
                'required' => false,
            ],
            'genericLinkCards' => [
                'type' => 'boolean',
                'default' => true,
                'label' => ['ko' => '일반 링크 스마트카드', 'en' => 'Generic link smart cards'],
                'hint' => ['ko' => 'SNS 외 일반 HTTPS 페이지 링크 카드를 허용합니다.', 'en' => 'Allow cards for general HTTPS pages outside supported social sites.'],
                'required' => false,
            ],
            'smartCardImages' => [
                'type' => 'boolean',
                'default' => false,
                'label' => ['ko' => '스마트카드 대표 이미지', 'en' => 'Smart card preview images'],
                'hint' => ['ko' => '기본 꺼짐입니다. 켜면 원문과 같은 호스트의 검증된 HTTPS 이미지만 표시합니다.', 'en' => 'Off by default. When enabled, only validated HTTPS images on the same host are shown.'],
                'required' => false,
            ],
            'imageMaxSizeMb' => [
                'type' => 'integer',
                'min' => 1,
                'max' => 10,
                'default' => 2,
                'label' => ['ko' => '이미지 최대 크기 (MB)', 'en' => 'Image max size (MB)'],
                'hint' => ['ko' => '업로드 파일당 1~10MB로 제한합니다.', 'en' => 'Limit each upload to 1-10 MB.'],
                'required' => false,
            ],
            'editorHeight' => [
                'type' => 'integer',
                'min' => 200,
                'max' => 2000,
                'default' => 400,
                'label' => ['ko' => '에디터 높이 (px)', 'en' => 'Editor height (px)'],
                'hint' => ['ko' => '에디터의 최소 높이입니다.', 'en' => 'Minimum editor height.'],
                'required' => false,
            ],
            'toolbar' => [
                'type' => 'enum',
                'options' => ['standard', 'minimal', 'full'],
                'default' => 'standard',
                'label' => ['ko' => '툴바 유형', 'en' => 'Toolbar profile'],
                'hint' => ['ko' => '용도에 맞는 도구 구성을 선택합니다.', 'en' => 'Choose the tool set for the editor.'],
                'required' => false,
            ],
            'public_asset_disk' => [
                'type' => 'string',
                'max' => 100,
                'default' => '',
                'label' => ['ko' => '공개 자산 디스크', 'en' => 'Public asset disk'],
                'hint' => ['ko' => '비우면 G7 공개 자산 디스크 설정을 따릅니다.', 'en' => 'Leave empty to follow the G7 public asset disk.'],
                'required' => false,
            ],
            'unusedImageCleanup' => [
                'type' => 'boolean',
                'default' => false,
                'label' => ['ko' => '미사용 이미지 자동 정리', 'en' => 'Clean unused images'],
                'hint' => ['ko' => '기본 꺼짐입니다. 켜면 보존기간이 지난 미참조 이미지를 매일 정리합니다.', 'en' => 'Off by default. When enabled, old unreferenced images are pruned daily.'],
                'required' => false,
            ],
            'unusedImageRetentionDays' => [
                'type' => 'integer',
                'min' => 1,
                'max' => 3650,
                'default' => 30,
                'label' => ['ko' => '미사용 이미지 보존기간 (일)', 'en' => 'Unused image retention (days)'],
                'hint' => ['ko' => '이 기간이 지난 미참조 이미지만 정리합니다.', 'en' => 'Only older unreferenced images are eligible.'],
                'required' => false,
            ],
        ];
    }

    public function getHooks(): array
    {
        return [
            $this->hook('jwsoft-tiptap-editor.image.before_upload', 'action', '업로드 직전 인증·쿼터 확장 지점', ['file' => 'UploadedFile', 'uploadedBy' => 'int|null']),
            $this->hook('jwsoft-tiptap-editor.image.after_upload', 'action', '업로드 레코드 생성 후 확장 지점', ['record' => 'JwsoftTiptapImageUpload']),
            $this->hook('jwsoft-tiptap-editor.image.filter_upload_file', 'filter', '이미지 최적화·변환 확장 지점', ['file' => 'UploadedFile']),
            $this->hook('jwsoft-tiptap-editor.image.filter_reference_sources', 'filter', '참조 스캔 소스 확장 지점', ['sources' => 'array']),
        ];
    }

    public function getPermissions(): array
    {
        return [
            'name' => ['ko' => 'JWSoft Tiptap 에디터', 'en' => 'JWSoft Tiptap Editor'],
            'description' => ['ko' => '에디터 업로드 이미지 관리 권한', 'en' => 'Editor upload management permissions'],
            'categories' => [[
                'identifier' => 'uploads',
                'name' => ['ko' => '에디터 업로드 이미지', 'en' => 'Editor uploads'],
                'description' => ['ko' => '업로드 이미지 조회·삭제', 'en' => 'View and delete uploaded images'],
                'permissions' => [
                    [
                        'action' => 'read',
                        'name' => ['ko' => '업로드 이미지 조회', 'en' => 'View uploads'],
                        'description' => ['ko' => '업로드와 참조 상태를 조회합니다.', 'en' => 'View uploads and reference state.'],
                        'type' => 'admin',
                        'roles' => ['admin'],
                    ],
                    [
                        'action' => 'delete',
                        'name' => ['ko' => '업로드 이미지 삭제', 'en' => 'Delete uploads'],
                        'description' => ['ko' => '업로드 파일과 기록을 삭제합니다.', 'en' => 'Delete upload files and records.'],
                        'type' => 'admin',
                        'roles' => ['admin'],
                    ],
                ],
            ]],
        ];
    }

    public function getAdminMenus(): array
    {
        return [[
            'name' => ['ko' => '에디터 업로드 이미지', 'en' => 'Editor uploads'],
            'slug' => 'jwsoft-tiptap-editor-uploads',
            'url' => '/admin/plugins/jwsoft-tiptap-editor/uploads',
            'icon' => 'fas fa-images',
            'order' => 50,
        ]];
    }

    public function getSchedules(): array
    {
        return [
            [
                'command' => 'jwsoft-tiptap-editor:prune-unused-images --scheduled',
                'schedule' => 'daily',
                'description' => '미참조 에디터 업로드 이미지 정리',
                'enabled_config' => 'jwsoft-tiptap-editor.unusedImageCleanup',
            ],
            [
                'command' => 'jwsoft-tiptap-editor:prune-media-sessions',
                'schedule' => 'hourly',
                'description' => '만료된 MP4 청크 업로드 세션 정리',
                'enabled_config' => null,
            ],
        ];
    }

    public function getStorageDiskFor(string $category): string
    {
        if (! in_array($category, ['images', 'media'], true)) {
            return $this->getStorageDisk();
        }

        $override = plugin_setting('jwsoft-tiptap-editor', 'public_asset_disk', '');

        return $this->resolvePublicAssetDisk(is_string($override) ? $override : '')
            ?? $this->getStorageDisk();
    }

    public function getDynamicTables(): array
    {
        return [
            'jwsoft_tiptap_image_uploads',
            'jwsoft_tiptap_media_uploads',
            'jwsoft_tiptap_media_upload_sessions',
        ];
    }

    /**
     * G7 7.0.9 게시글 HTML 저장 경로에 서버 canonical sanitizer를 연결합니다.
     *
     * @return array<int, array{class: class-string, groups: array<int, string>, timing: string, targets: array<int, string>}>
     */
    public function getMiddleware(): array
    {
        return [
            [
                'class' => Http\Middleware\CanonicalizeBoardPostHtml::class,
                'groups' => ['api'],
                'timing' => 'after_core',
                'targets' => [
                    'api.modules.sirsoft-board.boards.posts.store',
                    'api.modules.sirsoft-board.boards.posts.update',
                    'api.modules.sirsoft-board.admin.board.posts.store',
                    'api.modules.sirsoft-board.admin.board.posts.update',
                ],
            ],
        ];
    }

    /**
     * Prevent two replace-mode editors from competing for the same extension
     * points. Installation may coexist, activation may not.
     */
    public function activate(): bool
    {
        try {
            if (! $this->hasLegacyContentRiskAcknowledgement()) {
                return $this->failWith(
                    '활성화 전 플러그인 설정에서 “기존 콘텐츠 전환 위험 확인”을 켜십시오. 기존 CKEditor inline style·전용 class·HTML 구조는 편집·저장 시 달라질 수 있고 자동 변환되지 않습니다. 전환 문제가 있으면 JWSoft를 비활성화하고 CKEditor를 다시 활성화하십시오.'
                );
            }
        } catch (Throwable) {
            return $this->failWith(
                '기존 콘텐츠 전환 위험 확인 설정을 읽을 수 없어 안전하게 활성화를 중단했습니다.'
            );
        }

        try {
            $activePlugins = app(PluginManagerInterface::class)->getActivePlugins();

            foreach ($activePlugins as $identifier => $plugin) {
                $activeIdentifier = is_string($identifier)
                    ? $identifier
                    : (method_exists($plugin, 'getIdentifier') ? $plugin->getIdentifier() : null);

                if (in_array($activeIdentifier, self::CONFLICTING_PLUGINS, true)) {
                    return $this->failWith(
                        'sirsoft-ckeditor5를 먼저 비활성화한 뒤 JWSoft Tiptap 에디터를 활성화하십시오.'
                    );
                }
            }
        } catch (Throwable) {
            return $this->failWith(
                '활성 편집기 충돌 상태를 확인할 수 없어 안전하게 활성화를 중단했습니다.'
            );
        }

        if (! class_exists(ExtensionMenuSyncHelper::class)) {
            return true;
        }

        try {
            $helper = app(ExtensionMenuSyncHelper::class);
            foreach ($this->getAdminMenus() as $menu) {
                $helper->syncMenuRecursive($menu, ExtensionOwnerType::Plugin, $this->getIdentifier());
            }

            return true;
        } catch (Throwable) {
            return $this->failWith('관리자 이미지 메뉴를 동기화하지 못해 활성화를 중단했습니다.');
        }
    }

    public function deactivate(): bool
    {
        if (class_exists(ExtensionMenuSyncHelper::class)) {
            app(ExtensionMenuSyncHelper::class)->cleanupStaleMenus(
                ExtensionOwnerType::Plugin,
                $this->getIdentifier(),
                currentSlugs: [],
            );
        }

        return true;
    }

    public function uninstall(): bool
    {
        return $this->deactivate();
    }

    /**
     * @param array<string, string> $parameters
     * @return array<string, mixed>
     */
    private function hook(string $name, string $type, string $ko, array $parameters): array
    {
        return [
            'name' => $name,
            'type' => $type,
            'description' => ['ko' => $ko, 'en' => $ko],
            'parameters' => $parameters,
        ];
    }

    private function hasLegacyContentRiskAcknowledgement(): bool
    {
        if (! function_exists('plugin_setting')) {
            return false;
        }

        $value = plugin_setting(
            'jwsoft-tiptap-editor',
            self::LEGACY_CONTENT_RISK_SETTING,
            false,
        );

        return in_array($value, [true, 1, '1'], true);
    }
}

// G7은 세 개의 식별자 segment를 각각 namespace segment로 해석합니다.
// 제품의 정본 namespace는 Plugins\Jwsoft\TiptapEditor이며, 이 얇은 진입점만
// 현재 G7의 jwsoft-tiptap-editor 식별자 해석 계약을 연결합니다.
namespace Plugins\Jwsoft\Tiptap\Editor;

class Plugin extends \Plugins\Jwsoft\TiptapEditor\Plugin {}
