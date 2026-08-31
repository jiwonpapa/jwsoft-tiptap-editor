<?php

namespace App\Contracts\Extension {
    interface PluginManagerInterface
    {
        public function getActivePlugins(): array;
    }
}

namespace App\Extension {
    abstract class AbstractPlugin
    {
        private ?string $failureReason = null;

        protected function failWith(string $reason): bool
        {
            $this->failureReason = $reason;

            return false;
        }

        public function getLifecycleFailureReason(): ?string
        {
            return $this->failureReason;
        }
    }
}

namespace {
    use App\Contracts\Extension\PluginManagerInterface;
    use Plugins\Jwsoft\TiptapEditor\Plugin;

    final class FakePluginManager implements PluginManagerInterface
    {
        public function __construct(private readonly array $activePlugins) {}

        public function getActivePlugins(): array
        {
            return $this->activePlugins;
        }
    }

    function app(string $abstract): object
    {
        if ($abstract !== PluginManagerInterface::class) {
            throw new RuntimeException('Unexpected service: '.$abstract);
        }

        return $GLOBALS['jwsoft_plugin_manager'];
    }

    function plugin_setting(string $identifier, ?string $key = null, mixed $default = null): mixed
    {
        if ($identifier !== 'jwsoft-tiptap-editor' || $key === null) {
            return $default;
        }

        return $GLOBALS['jwsoft_plugin_settings'][$key] ?? $default;
    }

    require dirname(__DIR__, 2).'/plugin.php';

    $GLOBALS['jwsoft_plugin_manager'] = new FakePluginManager([]);
    $GLOBALS['jwsoft_plugin_settings'] = [];
    $plugin = new Plugin();
    if ($plugin->activate() !== true) {
        throw new RuntimeException('First activation must not require inaccessible inactive-plugin settings.');
    }

    $GLOBALS['jwsoft_plugin_settings']['legacyContentRiskAcknowledged'] = false;
    $plugin = new Plugin();
    if ($plugin->activate() !== true) {
        throw new RuntimeException('The retired acknowledgement setting must not block upgrades.');
    }

    $GLOBALS['jwsoft_plugin_manager'] = new FakePluginManager([
        'sirsoft-ckeditor5' => new stdClass(),
    ]);
    $plugin = new Plugin();
    if ($plugin->activate() !== false) {
        throw new RuntimeException('Plugin must reject activation with sirsoft-ckeditor5 active.');
    }
    foreach (['현재 CKEditor', '하나만 활성화', '관리자 → 플러그인', '먼저 비활성화', '활성화를 다시', '자동으로 꺼지지', '저장된 본문은 변경되지'] as $copy) {
        if (! str_contains((string) $plugin->getLifecycleFailureReason(), $copy)) {
            throw new RuntimeException("Conflict rejection must include an actionable reason: {$copy}");
        }
    }

    $middleware = $plugin->getMiddleware();
    $targets = $middleware[0]['targets'] ?? [];
    $expectedTargets = [
        'api.modules.sirsoft-board.boards.posts.store',
        'api.modules.sirsoft-board.boards.posts.update',
        'api.modules.sirsoft-board.admin.board.posts.store',
        'api.modules.sirsoft-board.admin.board.posts.update',
        'api.modules.sirsoft-ecommerce.admin.products.store',
        'api.modules.sirsoft-ecommerce.admin.products.update',
        'api.modules.sirsoft-ecommerce.admin.products.update-by-code',
        'api.modules.sirsoft-ecommerce.admin.product-common-infos.store',
        'api.modules.sirsoft-ecommerce.admin.product-common-infos.update',
        'api.modules.sirsoft-page.admin.pages.store',
        'api.modules.sirsoft-page.admin.pages.update',
    ];
    if (($middleware[0]['groups'] ?? []) !== ['api']
        || ($middleware[0]['timing'] ?? null) !== 'after_core'
        || $targets !== $expectedTargets) {
        throw new RuntimeException('Editor HTML middleware targets must match G7 7.0.9 write routes exactly.');
    }

    $settings = $plugin->getSettingsSchema();
    foreach (['imageUpload', 'dragDropImageUpload', 'pasteImageUpload', 'mediaEmbed', 'autoEmbedUrls', 'youtubeEmbed', 'vimeoEmbed', 'mp4Embed', 'videoUpload', 'videoMaxSizeMb', 'videoChunkSizeMb', 'mediaAutoplay', 'externalMediaLoadMode', 'smartCards', 'autoSmartCards', 'socialCards', 'genericLinkCards', 'smartCardImages', 'imageMaxSizeMb', 'editorHeight', 'toolbar', 'public_asset_disk', 'unusedImageCleanup', 'unusedImageRetentionDays'] as $setting) {
        if (! array_key_exists($setting, $settings)) {
            throw new RuntimeException("Missing image setting: {$setting}");
        }
    }
    if (($settings['imageMaxSizeMb']['min'] ?? null) !== 1
        || ($settings['imageMaxSizeMb']['max'] ?? null) !== 10
        || ($settings['unusedImageCleanup']['default'] ?? null) !== false
        || ($settings['dragDropImageUpload']['default'] ?? null) !== true
        || ($settings['pasteImageUpload']['default'] ?? null) !== true
        || ($settings['mediaEmbed']['default'] ?? null) !== false
        || ($settings['autoEmbedUrls']['default'] ?? null) !== false
        || ($settings['videoUpload']['default'] ?? null) !== false
        || ($settings['videoMaxSizeMb']['default'] ?? null) !== 200
        || ($settings['videoChunkSizeMb']['default'] ?? null) !== 5
        || ($settings['mediaAutoplay']['default'] ?? null) !== false
        || ($settings['externalMediaLoadMode']['default'] ?? null) !== 'immediate'
        || ($settings['smartCards']['default'] ?? null) !== false
        || ($settings['autoSmartCards']['default'] ?? null) !== false
        || ($settings['socialCards']['default'] ?? null) !== true
        || ($settings['genericLinkCards']['default'] ?? null) !== true
        || ($settings['smartCardImages']['default'] ?? null) !== false
        || array_key_exists('legacyContentRiskAcknowledged', $settings)) {
        throw new RuntimeException('Image size and fail-safe cleanup defaults mismatch.');
    }

    $settingsConfig = json_decode(
        file_get_contents(dirname(__DIR__, 2).'/config/settings/defaults.json'),
        true,
        flags: JSON_THROW_ON_ERROR,
    );
    if (array_key_exists('legacyContentRiskAcknowledged', $settingsConfig['defaults'])
        || array_key_exists('legacyContentRiskAcknowledged', $settingsConfig['frontend_schema'])
        || ($settingsConfig['frontend_schema']['dragDropImageUpload']['expose'] ?? null) !== true
        || ($settingsConfig['frontend_schema']['pasteImageUpload']['expose'] ?? null) !== true
        || ($settingsConfig['defaults']['videoUpload'] ?? null) !== false
        || ($settingsConfig['defaults']['smartCards'] ?? null) !== false
        || ($settingsConfig['frontend_schema']['socialCards']['expose'] ?? null) !== false
        || ($settingsConfig['frontend_schema']['smartCardImages']['expose'] ?? null) !== false) {
        throw new RuntimeException('Retired activation acknowledgement must be absent; feature defaults must stay fail-safe.');
    }

    $copy = json_decode(file_get_contents(dirname(__DIR__, 2).'/resources/lang/ko.json'), true, flags: JSON_THROW_ON_ERROR);
    foreach (['설치·활성화·조회만으로', '저장된 본문은 바뀌지 않습니다', '수정한 뒤 저장할 때', '새 글 작성에는', '이미 저장한 변경'] as $text) {
        if (! str_contains($copy['settings']['legacy_warning'], $text)) {
            throw new RuntimeException("Legacy warning scope missing: {$text}");
        }
    }

    $hooks = array_column($plugin->getHooks(), null, 'name');
    foreach (['before_upload', 'after_upload', 'filter_upload_file', 'filter_reference_sources'] as $suffix) {
        if (! isset($hooks["jwsoft-tiptap-editor.image.{$suffix}"])) {
            throw new RuntimeException("Missing public image hook: {$suffix}");
        }
    }

    $permissions = $plugin->getPermissions()['categories'][0]['permissions'] ?? [];
    if (array_column($permissions, 'action') !== ['read', 'delete']) {
        throw new RuntimeException('Upload management permissions must separate read and delete.');
    }
    if (($plugin->getAdminMenus()[0]['url'] ?? null) !== '/admin/plugins/jwsoft-tiptap-editor/uploads'
        || ($plugin->getSchedules()[0]['enabled_config'] ?? null) !== 'jwsoft-tiptap-editor.unusedImageCleanup'
        || ($plugin->getSchedules()[1]['command'] ?? null) !== 'jwsoft-tiptap-editor:prune-media-sessions'
        || $plugin->getDynamicTables() !== [
            'jwsoft_tiptap_image_uploads',
            'jwsoft_tiptap_media_uploads',
            'jwsoft_tiptap_media_upload_sessions',
        ]) {
        throw new RuntimeException('Image menu, schedule, or dynamic table contract mismatch.');
    }

    echo "[jwsoft] Plugin activation, settings, permission, hook, and schedule contracts passed\n";
}
