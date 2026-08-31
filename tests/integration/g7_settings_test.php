<?php

use App\Extension\PluginManager;
use App\Http\Requests\Admin\UpdatePluginSettingsRequest;
use App\Rules\ValidLayoutStructure;
use App\Rules\WhitelistedEndpoint;
use App\Services\PluginSettingsService;
use Illuminate\Container\Container;
use Illuminate\Config\Repository as ConfigRepository;
use Illuminate\Events\Dispatcher;
use Illuminate\Support\Facades\Facade;
use Plugins\Jwsoft\TiptapEditor\Plugin;

$g7Root = $argv[1] ?? '';
$projectRoot = $argv[2] ?? '';
require $g7Root.'/vendor/autoload.php';
require $projectRoot.'/vendor/autoload.php';
require_once $projectRoot.'/plugin.php';

function assertSettingsContract(bool $condition, string $message): void
{
    if (! $condition) {
        throw new RuntimeException($message);
    }
}

/** @return array<int, array<string, mixed>> */
function flattenSettingsComponents(array $components): array
{
    $result = [];
    foreach ($components as $component) {
        if (! is_array($component)) {
            continue;
        }
        $result[] = $component;
        foreach (['children', 'actions', 'onSuccess', 'onError'] as $key) {
            if (isset($component[$key]) && is_array($component[$key])) {
                $result = array_merge($result, flattenSettingsComponents($component[$key]));
            }
        }
    }

    return $result;
}

$layoutPath = $projectRoot.'/resources/layouts/admin/plugin_settings.json';
$layout = json_decode(file_get_contents($layoutPath), true, flags: JSON_THROW_ON_ERROR);
$layoutErrors = [];
(new ValidLayoutStructure())->validate('layout', $layout, function (string $message) use (&$layoutErrors): void {
    $layoutErrors[] = $message;
});
(new WhitelistedEndpoint())->validate('layout', $layout, function (string $message) use (&$layoutErrors): void {
    $layoutErrors[] = $message;
});
assertSettingsContract($layoutErrors === [], 'plugin settings layout failed G7 structure or endpoint validation: '.implode('; ', $layoutErrors));
assertSettingsContract(($layout['permissions'] ?? []) === ['core.plugins.update'], 'settings layout permission mismatch');

$components = flattenSettingsComponents($layout['slots']['content'] ?? []);
$controlNames = [];
$putTargetFound = false;
foreach ($components as $component) {
    $name = $component['props']['name'] ?? null;
    if (is_string($name) && $name !== '') {
        $controlNames[] = $name;
    }
    if (($component['handler'] ?? null) === 'apiCall'
        && ($component['target'] ?? null) === '/api/admin/plugins/jwsoft-tiptap-editor/settings'
        && ($component['params']['method'] ?? null) === 'PUT'
        && ($component['auth_required'] ?? null) === true) {
        $putTargetFound = true;
    }
}

$editorMediaSettings = [
    'toolbar',
    'editorHeight',
    'imageUpload',
    'dragDropImageUpload',
    'pasteImageUpload',
    'imageMaxSizeMb',
    'mediaEmbed',
    'autoEmbedUrls',
    'youtubeEmbed',
    'vimeoEmbed',
    'mp4Embed',
    'videoUpload',
    'videoMaxSizeMb',
    'videoChunkSizeMb',
    'mediaAutoplay',
    'externalMediaLoadMode',
    'smartCards',
    'autoSmartCards',
    'socialCards',
    'xEmbed',
    'facebookEmbed',
    'genericLinkCards',
    'smartCardImages',
    'public_asset_disk',
    'unusedImageCleanup',
    'unusedImageRetentionDays',
];
sort($editorMediaSettings);
$controlNames = array_values(array_unique($controlNames));
sort($controlNames);
assertSettingsContract($controlNames === $editorMediaSettings, 'settings layout controls do not match the editor/media schema surface');
assertSettingsContract($putTargetFound, 'settings layout is missing authenticated PUT save action');

$routes = json_decode(file_get_contents($projectRoot.'/resources/routes.json'), true, flags: JSON_THROW_ON_ERROR);
$settingsRoute = array_values(array_filter($routes['routes'], fn (array $route): bool => $route['path'] === '*/admin/plugins/jwsoft-tiptap-editor/settings'));
assertSettingsContract(count($settingsRoute) === 1, 'settings page must have an explicit plugin-owned route');
assertSettingsContract($settingsRoute[0]['layout'] === 'plugin_settings' && $settingsRoute[0]['auth_required'] === true && $settingsRoute[0]['meta']['permission'] === 'core.plugins.update', 'settings route must preserve authentication and permission');
assertSettingsContract($layout['data_sources'][0]['endpoint'] === '/api/admin/plugins/jwsoft-tiptap-editor/settings', 'fixed settings route must not depend on a missing route.identifier parameter');
assertSettingsContract(! str_contains(file_get_contents($layoutPath), 'legacyContentRiskAcknowledged'), 'settings must not contain the retired activation toggle');

$plugin = new Plugin();
$managerReflection = new ReflectionClass(PluginManager::class);
/** @var PluginManager $pluginManager */
$pluginManager = $managerReflection->newInstanceWithoutConstructor();
$pluginsProperty = $managerReflection->getProperty('plugins');
$pluginsProperty->setValue($pluginManager, ['jwsoft-tiptap-editor' => $plugin]);

$container = new Container();
$container->instance('events', new Dispatcher($container));
$container->instance(PluginManager::class, $pluginManager);
Container::setInstance($container);
Facade::setFacadeApplication($container);

$request = UpdatePluginSettingsRequest::create('/api/admin/plugins/jwsoft-tiptap-editor/settings', 'PUT');
$request->setContainer($container);
$request->setRouteResolver(static fn (): object => new class {
    public function parameter(string $key): ?string
    {
        return $key === 'identifier' ? 'jwsoft-tiptap-editor' : null;
    }
});
$rules = $request->rules();
foreach ($editorMediaSettings as $setting) {
    assertSettingsContract(isset($rules[$setting]), "G7 dynamic validation rule missing: {$setting}");
}
assertSettingsContract(in_array('integer', $rules['imageMaxSizeMb'], true), 'imageMaxSizeMb must use G7 integer validation');
assertSettingsContract(in_array('min:1', $rules['imageMaxSizeMb'], true), 'imageMaxSizeMb minimum validation missing');
assertSettingsContract(in_array('max:10', $rules['imageMaxSizeMb'], true), 'imageMaxSizeMb maximum validation missing');
assertSettingsContract(in_array('in:standard,minimal,full', $rules['toolbar'], true), 'toolbar enum validation mismatch');
assertSettingsContract(in_array('in:click,immediate', $rules['externalMediaLoadMode'], true), 'external media load mode validation mismatch');
assertSettingsContract(count(array_filter($rules['public_asset_disk'], 'is_callable')) === 1, 'public asset disk must use the G7 driver allowlist validator');
assertSettingsContract(in_array('min:1', $rules['unusedImageRetentionDays'], true), 'cleanup retention minimum validation missing');
assertSettingsContract(in_array('max:3650', $rules['unusedImageRetentionDays'], true), 'cleanup retention maximum validation missing');

$layoutSource = file_get_contents($layoutPath);
assertSettingsContract(is_string($layoutSource), 'settings layout source is unreadable');
assertSettingsContract(str_contains($layoutSource, 'available_public_asset_disks'), 'public asset disk selector does not use the G7 catalog');
assertSettingsContract(str_contains($layoutSource, '/admin/plugins/jwsoft-tiptap-editor/uploads'), 'cleanup settings do not link to upload review');

$settingValues = ['public_asset_disk' => ''];
$settingsService = new class($settingValues) extends PluginSettingsService {
    /** @var array<string, mixed> */
    private array $values;

    /** @param array<string, mixed> $values */
    public function __construct(array &$values)
    {
        $this->values = &$values;
    }

    public function get(string $identifier, ?string $key = null, mixed $default = null): mixed
    {
        if ($identifier !== 'jwsoft-tiptap-editor') {
            return $default;
        }

        return $key === null ? $this->values : ($this->values[$key] ?? $default);
    }
};
$container->instance(PluginSettingsService::class, $settingsService);
$container->instance('config', new ConfigRepository([
    'app' => ['translatable_locales' => ['ko', 'en']],
    'core' => ['storage' => ['public_asset_disk' => 'public']],
    'filesystems' => ['disks' => [
        'plugins' => ['driver' => 'local'],
        'public' => ['driver' => 'local'],
        's3' => ['driver' => 's3'],
    ]],
]));

assertSettingsContract($plugin->getStorageDiskFor('settings') === 'plugins', 'settings storage must never recurse through the public asset override');
assertSettingsContract($plugin->getStorageDiskFor('images') === 'public', 'empty image override must follow the G7 public asset disk');
assertSettingsContract($plugin->getStorageDiskFor('media') === 'public', 'empty media override must follow the G7 public asset disk');
$settingValues['public_asset_disk'] = 's3';
assertSettingsContract($plugin->getStorageDiskFor('images') === 's3', 'image storage override was not applied');
assertSettingsContract($plugin->getStorageDiskFor('media') === 's3', 'media storage override was not applied');
$settingValues['public_asset_disk'] = 'none';
assertSettingsContract($plugin->getStorageDiskFor('images') === 'plugins', 'none override must preserve streamed plugin storage');
$settingValues['public_asset_disk'] = 'orphan-driver';
assertSettingsContract($plugin->getStorageDiskFor('media') === 'plugins', 'orphaned public disk must fail safe to plugin storage');

$cleanupSchedule = $plugin->getSchedules()[0] ?? [];
assertSettingsContract(($cleanupSchedule['enabled_config'] ?? null) === 'jwsoft-tiptap-editor.unusedImageCleanup', 'cleanup schedule does not consume the enable setting');
assertSettingsContract(($cleanupSchedule['schedule'] ?? null) === 'daily', 'cleanup schedule must run daily when enabled');

$defaults = json_decode(file_get_contents($projectRoot.'/config/settings/defaults.json'), true, flags: JSON_THROW_ON_ERROR);
$editorExtension = file_get_contents($projectRoot.'/resources/extensions/html-editor.json');
$contentExtension = file_get_contents($projectRoot.'/resources/extensions/html-content.json');
assertSettingsContract(is_string($editorExtension) && is_string($contentExtension), 'extension settings bindings are unreadable');

$frontendEditorSettings = [
    'socialCards', 'xEmbed', 'facebookEmbed',
    'imageUpload',
    'dragDropImageUpload',
    'pasteImageUpload',
    'imageMaxSizeMb',
    'mediaEmbed',
    'autoEmbedUrls',
    'youtubeEmbed',
    'vimeoEmbed',
    'mp4Embed',
    'videoUpload',
    'videoMaxSizeMb',
    'mediaAutoplay',
    'externalMediaLoadMode',
    'smartCards',
    'autoSmartCards',
    'editorHeight',
    'toolbar',
];
foreach ($frontendEditorSettings as $setting) {
    assertSettingsContract(($defaults['frontend_schema'][$setting]['expose'] ?? false) === true, "frontend schema does not expose: {$setting}");
    assertSettingsContract(str_contains($editorExtension, "?.{$setting} ??"), "html_editor does not bind frontend setting: {$setting}");
}
foreach (['mediaAutoplay', 'externalMediaLoadMode', 'smartCards', 'socialCards', 'xEmbed', 'facebookEmbed'] as $setting) {
    assertSettingsContract(($defaults['frontend_schema'][$setting]['expose'] ?? false) === true, "frontend schema does not expose content setting: {$setting}");
    assertSettingsContract(str_contains($contentExtension, "?.{$setting} ??"), "html_content does not bind frontend setting: {$setting}");
}
foreach (['videoChunkSizeMb', 'genericLinkCards', 'smartCardImages'] as $serverOnly) {
    assertSettingsContract(($defaults['frontend_schema'][$serverOnly]['expose'] ?? true) === false, "server-only setting leaked to public frontend: {$serverOnly}");
}

echo "[jwsoft] G7 editor/media/storage/cleanup settings UI, validation, and runtime bindings passed\n";
