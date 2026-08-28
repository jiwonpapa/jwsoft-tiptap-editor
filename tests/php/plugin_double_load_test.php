<?php

namespace App\Extension {
    abstract class AbstractPlugin {}
}

namespace {
    $pluginPath = realpath(__DIR__.'/../../plugin.php');
    if ($pluginPath === false) {
        throw new RuntimeException('plugin.php not found');
    }

    require $pluginPath;
    require $pluginPath;

    if (! class_exists(Plugins\Jwsoft\TiptapEditor\Plugin::class, false)) {
        throw new RuntimeException('canonical plugin class was not loaded');
    }
    if (! class_exists(Plugins\Jwsoft\Tiptap\Editor\Plugin::class, false)) {
        throw new RuntimeException('G7 namespace bridge class was not loaded');
    }

    echo "[jwsoft] Plugin entrypoint duplicate-load guard passed\n";
}
