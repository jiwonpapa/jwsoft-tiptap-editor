<?php

/** Read-only deployment comparison. Emit counts and hashes, never stored bodies. */
use Illuminate\Support\Facades\DB;

$g7Root = realpath($argv[1] ?? '');
if ($g7Root === false || ! is_file($g7Root.'/artisan')) {
    throw new RuntimeException('G7 root missing.');
}
chdir($g7Root);
require $g7Root.'/vendor/autoload.php';
$app = require $g7Root.'/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
$tables = [
    'pages' => ['id', 'content'],
    'board_posts' => ['id', 'content'],
    'ecommerce_products' => ['id', 'description'],
    'modules' => ['*'],
];
$result = [];
DB::transaction(function () use ($tables, &$result): void {
    foreach ($tables as $table => $columns) {
        $digest = hash_init('sha256');
        $count = 0;
        foreach (DB::table($table)->select($columns)->orderBy('id')->cursor() as $row) {
            $encoded = json_encode($row, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE);
            hash_update($digest, strlen($encoded).':'.$encoded);
            $count++;
        }
        $result[$table] = ['count' => $count, 'sha256' => hash_final($digest)];
    }
});
echo json_encode($result, JSON_THROW_ON_ERROR | JSON_PRETTY_PRINT).PHP_EOL;
