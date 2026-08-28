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

    echo "[jwsoft] Plugin activation conflict test passed\n";
}
