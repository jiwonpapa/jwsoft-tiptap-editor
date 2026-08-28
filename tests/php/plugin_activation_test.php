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
    if ($plugin->activate() !== false) {
        throw new RuntimeException('Plugin must reject activation before legacy content risk acknowledgement.');
    }
    $acknowledgementFailure = (string) $plugin->getLifecycleFailureReason();
    foreach (['기존 콘텐츠 전환 위험 확인', '자동 변환되지 않습니다', 'CKEditor를 다시 활성화'] as $copy) {
        if (! str_contains($acknowledgementFailure, $copy)) {
            throw new RuntimeException("Transition acknowledgement failure must include: {$copy}");
        }
    }

    $GLOBALS['jwsoft_plugin_settings']['legacyContentRiskAcknowledged'] = true;
    $plugin = new Plugin();
    if ($plugin->activate() !== true) {
        throw new RuntimeException('Plugin should activate without a conflicting editor.');
    }

    $GLOBALS['jwsoft_plugin_manager'] = new FakePluginManager([
        'sirsoft-ckeditor5' => new stdClass(),
    ]);
    $plugin = new Plugin();
    if ($plugin->activate() !== false) {
        throw new RuntimeException('Plugin must reject activation with sirsoft-ckeditor5 active.');
    }
    if (! str_contains((string) $plugin->getLifecycleFailureReason(), '먼저 비활성화')) {
        throw new RuntimeException('Conflict rejection must include an operator-facing reason.');
    }

    $middleware = $plugin->getMiddleware();
    $targets = $middleware[0]['targets'] ?? [];
    $expectedTargets = [
        'api.modules.sirsoft-board.boards.posts.store',
        'api.modules.sirsoft-board.boards.posts.update',
        'api.modules.sirsoft-board.admin.board.posts.store',
        'api.modules.sirsoft-board.admin.board.posts.update',
    ];
    if (($middleware[0]['groups'] ?? []) !== ['api']
        || ($middleware[0]['timing'] ?? null) !== 'after_core'
        || $targets !== $expectedTargets) {
        throw new RuntimeException('Board HTML middleware targets must match G7 7.0.9 write routes exactly.');
    }

    $settings = $plugin->getSettingsSchema();
    foreach (['legacyContentRiskAcknowledged', 'imageUpload', 'dragDropImageUpload', 'pasteImageUpload', 'imageMaxSizeMb', 'editorHeight', 'toolbar', 'public_asset_disk', 'unusedImageCleanup', 'unusedImageRetentionDays'] as $setting) {
        if (! array_key_exists($setting, $settings)) {
            throw new RuntimeException("Missing image setting: {$setting}");
        }
    }
    if (($settings['imageMaxSizeMb']['min'] ?? null) !== 1
        || ($settings['imageMaxSizeMb']['max'] ?? null) !== 10
        || ($settings['unusedImageCleanup']['default'] ?? null) !== false
        || ($settings['dragDropImageUpload']['default'] ?? null) !== true
        || ($settings['pasteImageUpload']['default'] ?? null) !== true
        || ($settings['legacyContentRiskAcknowledged']['default'] ?? null) !== false
        || ! str_contains((string) ($settings['legacyContentRiskAcknowledged']['hint']['ko'] ?? ''), '자동 변환되지 않습니다')) {
        throw new RuntimeException('Image size and fail-safe cleanup defaults mismatch.');
    }

    $settingsConfig = json_decode(
        file_get_contents(dirname(__DIR__, 2).'/config/settings/defaults.json'),
        true,
        flags: JSON_THROW_ON_ERROR,
    );
    if (($settingsConfig['defaults']['legacyContentRiskAcknowledged'] ?? null) !== false
        || ($settingsConfig['frontend_schema']['legacyContentRiskAcknowledged']['expose'] ?? null) !== false
        || ($settingsConfig['frontend_schema']['dragDropImageUpload']['expose'] ?? null) !== true
        || ($settingsConfig['frontend_schema']['pasteImageUpload']['expose'] ?? null) !== true) {
        throw new RuntimeException('Transition acknowledgement must default off and stay server-side.');
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
        || $plugin->getDynamicTables() !== ['jwsoft_tiptap_image_uploads']) {
        throw new RuntimeException('Image menu, schedule, or dynamic table contract mismatch.');
    }

    echo "[jwsoft] Plugin activation, settings, permission, hook, and schedule contracts passed\n";
}
