<?php

// Deliberately old HTML belongs only to the fresh browser-run product fixture.
require_once __DIR__.'/require_dedicated_host.php';
$root = realpath($argv[1] ?? '');
$file = realpath($argv[2] ?? '');
$id = (int) ($argv[3] ?? 0);
if (! $root || ! $file || $id < 1) throw new RuntimeException('Fixture arguments missing.');
requireDedicatedEditorHost($root);
require $root.'/vendor/autoload.php';
$app = require $root.'/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
$db = Illuminate\Support\Facades\DB::connection();
if (! $app->environment('local') || $db->getConfig('database') !== 'g7_testing'
    || (array) $db->getConfig('host') !== ['127.0.0.1']) {
    throw new RuntimeException('Only the disposable local browser database is supported.');
}
$fixture = json_decode(file_get_contents($file), true, flags: JSON_THROW_ON_ERROR);
$product = $db->table('ecommerce_products')->where('id', $id)->first();
if (! $product || (int) $product->created_by !== $fixture['id']
    || $product->product_code !== 'JW-'.$fixture['runId']) {
    throw new RuntimeException('Only this run-owned product may receive legacy fixture HTML.');
}
$db->table('ecommerce_products')->where('id', $id)->update(['description' => json_encode([
    'ko' => '<p style="color:red">Legacy '.$fixture['runId'].'</p>',
    'en' => '<p>English fixture</p>',
    'ja' => '<p style="color:blue">Retired locale '.$fixture['runId'].'</p>',
], JSON_THROW_ON_ERROR)]);
echo "Legacy fixture prepared for the run-owned product.\n";
