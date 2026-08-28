<?php

namespace Plugins\Jwsoft\TiptapEditor;

use App\Contracts\Extension\PluginManagerInterface;
use App\Extension\AbstractPlugin;
use Throwable;

/**
 * G7 editor replacement plugin.
 */
class Plugin extends AbstractPlugin
{
    private const CONFLICTING_PLUGINS = [
        'sirsoft-ckeditor5',
    ];

    /**
     * Prevent two replace-mode editors from competing for the same extension
     * points. Installation may coexist, activation may not.
     */
    public function activate(): bool
    {
        try {
            $activePlugins = app(PluginManagerInterface::class)->getActivePlugins();

            foreach ($activePlugins as $identifier => $plugin) {
                $activeIdentifier = is_string($identifier)
                    ? $identifier
                    : (method_exists($plugin, 'getIdentifier') ? $plugin->getIdentifier() : null);

                if (in_array($activeIdentifier, self::CONFLICTING_PLUGINS, true)) {
                    return $this->failWith(
                        'sirsoft-ckeditor5를 먼저 비활성화한 뒤 JWSoft Tiptap 에디터를 활성화하십시오.'
                    );
                }
            }

            return true;
        } catch (Throwable) {
            return $this->failWith(
                '활성 편집기 충돌 상태를 확인할 수 없어 안전하게 활성화를 중단했습니다.'
            );
        }
    }
}
