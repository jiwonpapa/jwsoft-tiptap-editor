<?php

use App\Extension\PluginManager;
use App\Http\Requests\Admin\UpdatePluginSettingsRequest;
use App\Rules\ValidLayoutStructure;
use App\Rules\WhitelistedEndpoint;
use Illuminate\Container\Container;
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
        && ($component['target'] ?? null) === '/api/admin/plugins/{{route.identifier}}/settings'
        && ($component['params']['method'] ?? null) === 'PUT'
        && ($component['auth_required'] ?? null) === true) {
        $putTargetFound = true;
    }
}

$editorMediaSettings = [
    'legacyContentRiskAcknowledged',
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
    'genericLinkCards',
    'smartCardImages',
];
sort($editorMediaSettings);
$controlNames = array_values(array_unique($controlNames));
sort($controlNames);
assertSettingsContract($controlNames === $editorMediaSettings, 'settings layout controls do not match the editor/media schema surface');
assertSettingsContract($putTargetFound, 'settings layout is missing authenticated PUT save action');

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

$defaults = json_decode(file_get_contents($projectRoot.'/config/settings/defaults.json'), true, flags: JSON_THROW_ON_ERROR);
$editorExtension = file_get_contents($projectRoot.'/resources/extensions/html-editor.json');
$contentExtension = file_get_contents($projectRoot.'/resources/extensions/html-content.json');
assertSettingsContract(is_string($editorExtension) && is_string($contentExtension), 'extension settings bindings are unreadable');

$frontendEditorSettings = [
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
    'smartCards',
    'autoSmartCards',
    'editorHeight',
    'toolbar',
];
foreach ($frontendEditorSettings as $setting) {
    assertSettingsContract(($defaults['frontend_schema'][$setting]['expose'] ?? false) === true, "frontend schema does not expose: {$setting}");
    assertSettingsContract(str_contains($editorExtension, "?.{$setting} ??"), "html_editor does not bind frontend setting: {$setting}");
}
foreach (['mediaAutoplay', 'externalMediaLoadMode'] as $setting) {
    assertSettingsContract(($defaults['frontend_schema'][$setting]['expose'] ?? false) === true, "frontend schema does not expose content setting: {$setting}");
    assertSettingsContract(str_contains($contentExtension, "?.{$setting} ??"), "html_content does not bind frontend setting: {$setting}");
}
foreach (['legacyContentRiskAcknowledged', 'videoChunkSizeMb', 'socialCards', 'genericLinkCards', 'smartCardImages'] as $serverOnly) {
    assertSettingsContract(($defaults['frontend_schema'][$serverOnly]['expose'] ?? true) === false, "server-only setting leaked to public frontend: {$serverOnly}");
}

echo "[jwsoft] G7 editor/media settings UI, validation, and runtime bindings passed\n";
