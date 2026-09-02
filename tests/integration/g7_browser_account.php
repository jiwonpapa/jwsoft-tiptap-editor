<?php

// Disposable browser identity in a registered, local G7 test database only.
require_once __DIR__.'/require_dedicated_host.php';
$root = realpath($argv[1] ?? '');
$action = $argv[2] ?? '';
$file = $argv[3] ?? '';
$runId = $argv[4] ?? '';
if (! $root || ! in_array($action, ['create', 'revoke'], true)
    || ! preg_match('/^[a-f0-9]{32}$/', $runId)) {
    throw new RuntimeException('Dedicated root, action, credential file and run ID required.');
}
requireDedicatedEditorHost($root);
$output = realpath(dirname(__DIR__, 2).'/output/playwright');
$parent = realpath(dirname($file));
if (! $output || ! $parent || ! str_starts_with($parent.'/', $output.'/') || is_link($file)) {
    throw new RuntimeException('Credentials must remain in the isolated browser output directory.');
}
require $root.'/vendor/autoload.php';
$app = require $root.'/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
$db = Illuminate\Support\Facades\DB::connection();
if (! $app->environment('local') || $db->getConfig('database') !== 'g7_testing'
    || (array) $db->getConfig('host') !== ['127.0.0.1']) {
    throw new RuntimeException('Only the disposable local g7_testing database is supported.');
}
$email = 'jw-editor-'.$runId.'@example.invalid';
$user = App\Models\User::where('email', $email)->first();
if ($action === 'create') {
    if ($user || file_exists($file)) throw new RuntimeException('Do not overwrite an identity.');
    $password = bin2hex(random_bytes(32));
    $user = App\Models\User::create([
        'name' => 'Release QA', 'email' => $email, 'password' => $password,
        'is_super' => true, 'status' => 'active', 'language' => 'ko', 'timezone' => 'Asia/Seoul',
    ]);
    $user->forceFill(['email_verified_at' => now()])->save();
    $user->roles()->syncWithoutDetaching(App\Models\Role::where('identifier', 'admin')->pluck('id')->all());
    file_put_contents($file, json_encode([
        'id' => $user->id, 'email' => $email, 'password' => $password, 'runId' => $runId,
    ], JSON_THROW_ON_ERROR));
    chmod($file, 0600);
    echo "Dedicated browser identity created.\n";
} else {
    if (! $user || $user->name !== 'Release QA') throw new RuntimeException('Fixture identity missing.');
    $user->roles()->detach();
    $user->tokens()->delete();
    $user->forceFill(['is_super' => false, 'password' => bin2hex(random_bytes(48))])->save();
    // Keep non-secret fixture ownership for reproducible record verification.
    file_put_contents($file, json_encode(['id' => $user->id, 'runId' => $runId, 'revoked' => true]));
    echo "Dedicated browser identity revoked.\n";
}
