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

    require dirname(__DIR__, 2).'/plugin.php';

    $GLOBALS['jwsoft_plugin_manager'] = new FakePluginManager([]);
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

    echo "[jwsoft] Plugin activation conflict test passed\n";
}
