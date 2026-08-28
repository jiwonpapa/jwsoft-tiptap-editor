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
        return [[
            'command' => 'jwsoft-tiptap-editor:prune-unused-images --scheduled',
            'schedule' => 'daily',
            'description' => '미참조 에디터 업로드 이미지 정리',
            'enabled_config' => 'jwsoft-tiptap-editor.unusedImageCleanup',
        ]];
    }

    public function getStorageDiskFor(string $category): string
    {
        if ($category !== 'images') {
            return $this->getStorageDisk();
        }

        $override = plugin_setting('jwsoft-tiptap-editor', 'public_asset_disk', '');

        return $this->resolvePublicAssetDisk(is_string($override) ? $override : '')
            ?? $this->getStorageDisk();
    }

    public function getDynamicTables(): array
    {
        return ['jwsoft_tiptap_image_uploads'];
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
