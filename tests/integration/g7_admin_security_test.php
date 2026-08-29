<?php

use Illuminate\Container\Container;
use Illuminate\Events\Dispatcher;
use Illuminate\Routing\Router;
use Illuminate\Support\Facades\Facade;
use Illuminate\Support\Facades\Route;
use Plugins\Jwsoft\TiptapEditor\Plugin;

$g7Root = $argv[1] ?? '';
$projectRoot = $argv[2] ?? '';
require $g7Root.'/vendor/autoload.php';
require $projectRoot.'/vendor/autoload.php';
require_once $projectRoot.'/plugin.php';

function assertAdminSecurity(bool $condition, string $message): void
{
    if (! $condition) {
        throw new RuntimeException($message);
    }
}

/** @return list<string> */
function extractLogCalls(string $source): array
{
    $tokens = token_get_all($source);
    $calls = [];
    $count = count($tokens);
    for ($index = 0; $index < $count; $index++) {
        $token = $tokens[$index];
        if (! is_array($token) || $token[0] !== T_STRING || $token[1] !== 'Log') {
            continue;
        }
        $cursor = $index + 1;
        while ($cursor < $count && is_array($tokens[$cursor]) && $tokens[$cursor][0] === T_WHITESPACE) {
            $cursor++;
        }
        if ($cursor >= $count || ! is_array($tokens[$cursor]) || $tokens[$cursor][0] !== T_DOUBLE_COLON) {
            continue;
        }
        while ($cursor < $count && $tokens[$cursor] !== '(') {
            $cursor++;
        }
        if ($cursor >= $count) {
            continue;
        }
        $depth = 0;
        $call = 'Log::';
        for (; $cursor < $count; $cursor++) {
            $part = is_array($tokens[$cursor]) ? $tokens[$cursor][1] : $tokens[$cursor];
            $call .= $part;
            if ($part === '(') {
                $depth++;
            } elseif ($part === ')') {
                $depth--;
                if ($depth === 0) {
                    $calls[] = $call;
                    break;
                }
            }
        }
    }

    return $calls;
}

$plugin = new Plugin();
$permissionDefinition = $plugin->getPermissions();
$category = $permissionDefinition['categories'][0] ?? [];
$permissions = $category['permissions'] ?? [];
assertAdminSecurity(($category['identifier'] ?? null) === 'uploads', 'upload permission category identifier mismatch');
assertAdminSecurity(array_column($permissions, 'action') === ['read', 'delete'], 'admin upload permissions must separate read and delete');
foreach ($permissions as $permission) {
    assertAdminSecurity(($permission['type'] ?? null) === 'admin', 'upload permission must be admin-scoped');
    assertAdminSecurity(($permission['roles'] ?? null) === ['admin'], 'upload permission default role mismatch');
}
assertAdminSecurity(($plugin->getAdminMenus()[0]['url'] ?? null) === '/admin/plugins/jwsoft-tiptap-editor/uploads', 'admin menu URL mismatch');

$uploadsLayout = json_decode(file_get_contents($projectRoot.'/resources/layouts/admin/tiptap_uploads.json'), true, flags: JSON_THROW_ON_ERROR);
$settingsLayout = json_decode(file_get_contents($projectRoot.'/resources/layouts/admin/plugin_settings.json'), true, flags: JSON_THROW_ON_ERROR);
assertAdminSecurity(($uploadsLayout['permissions'] ?? null) === ['jwsoft-tiptap-editor.uploads.read'], 'uploads screen permission mismatch');
assertAdminSecurity(($settingsLayout['permissions'] ?? null) === ['core.plugins.update'], 'settings screen permission mismatch');

$container = new Container();
$container->instance('events', new Dispatcher($container));
Facade::setFacadeApplication($container);
$router = new Router($container['events'], $container);
$container->instance('router', $router);
Route::prefix('api/plugins/jwsoft-tiptap-editor')
    ->name('api.plugins.jwsoft-tiptap-editor.')
    ->middleware('api')
    ->group($projectRoot.'/src/routes/api.php');

$expectedRoutes = [
    'api/plugins/jwsoft-tiptap-editor/admin/uploads|GET,HEAD' => 'permission:admin,jwsoft-tiptap-editor.uploads.read',
    'api/plugins/jwsoft-tiptap-editor/admin/uploads/bulk-delete|POST' => 'permission:admin,jwsoft-tiptap-editor.uploads.delete',
    'api/plugins/jwsoft-tiptap-editor/admin/uploads/{id}|DELETE' => 'permission:admin,jwsoft-tiptap-editor.uploads.delete',
];
$actualRoutes = [];
foreach ($router->getRoutes() as $route) {
    $key = $route->uri().'|'.implode(',', $route->methods());
    if (isset($expectedRoutes[$key])) {
        $actualRoutes[$key] = $route->middleware();
    }
}
assertAdminSecurity(count($actualRoutes) === count($expectedRoutes), 'admin upload route count mismatch');
foreach ($expectedRoutes as $key => $permission) {
    assertAdminSecurity(in_array('auth:sanctum', $actualRoutes[$key] ?? [], true), "admin route missing auth: {$key}");
    assertAdminSecurity(in_array($permission, $actualRoutes[$key] ?? [], true), "admin route permission mismatch: {$key}");
}

$phpFiles = [];
$iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($projectRoot.'/src'));
foreach ($iterator as $file) {
    if ($file->isFile() && $file->getExtension() === 'php') {
        $phpFiles[] = $file->getPathname();
    }
}
$logCalls = [];
foreach ($phpFiles as $file) {
    foreach (extractLogCalls(file_get_contents($file)) as $call) {
        $logCalls[$file][] = $call;
    }
}
assertAdminSecurity($logCalls !== [], 'plugin error log inventory is empty');
$forbiddenContextKey = '/[\'\"](?:token|content|body|headers?|url|original_name|file_path|authorization|cookie|password|secret)[\'\"]\s*=>/i';
$forbiddenVariable = '/\$(?:token|content|body|payload|request|headers?|url|originalName)\b/';
foreach ($logCalls as $file => $calls) {
    foreach ($calls as $call) {
        assertAdminSecurity(! preg_match($forbiddenContextKey, $call), "sensitive log context key in {$file}: {$call}");
        assertAdminSecurity(! preg_match($forbiddenVariable, $call), "raw request value in log call in {$file}: {$call}");
        assertAdminSecurity(! str_contains($call, '->getMessage('), "exception message leaked to log in {$file}: {$call}");
    }
}

$listenerSource = file_get_contents($g7Root.'/app/Listeners/CoreActivityLogListener.php');
assertAdminSecurity(is_string($listenerSource), 'G7 core activity listener is unreadable');
$methodStart = strpos($listenerSource, 'function handlePluginSettingsAfterSave');
$methodEnd = strpos($listenerSource, 'function handlePluginSettingsAfterReset', $methodStart ?: 0);
assertAdminSecurity($methodStart !== false && $methodEnd !== false, 'G7 plugin settings activity handler not found');
$activityHandler = substr($listenerSource, $methodStart, $methodEnd - $methodStart);
assertAdminSecurity(str_contains($activityHandler, "'keys' => array_keys(\$settings)"), 'G7 activity log must record setting keys only');
assertAdminSecurity(! preg_match('/[\'\"](?:settings|values|payload|content)[\'\"]\s*=>\s*\$settings/i', $activityHandler), 'G7 activity log exposes raw settings');

$settingsController = file_get_contents($g7Root.'/app/Http/Controllers/Api/Admin/PluginSettingsController.php');
assertAdminSecurity(is_string($settingsController) && str_contains($settingsController, '$settings = $request->validated();'), 'G7 settings save must use validated fields only');
assertAdminSecurity(! str_contains($settingsController, '$request->all()'), 'G7 settings save falls back to unvalidated input');

echo "[jwsoft] G7 admin menu, read/delete permissions, and safe logging contracts passed\n";
