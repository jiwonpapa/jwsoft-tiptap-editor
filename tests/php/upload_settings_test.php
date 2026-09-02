<?php

namespace Illuminate\Foundation\Http {
    class FormRequest {}
}

namespace {
    $enabled = false;
    function plugin_setting(string $identifier, string $key, mixed $default = null): mixed
    {
        global $enabled;
        return $enabled;
    }

    require __DIR__.'/../../src/Http/Requests/ImageUploadRequest.php';
    require __DIR__.'/../../src/Http/Requests/BeginMediaUploadRequest.php';
    foreach ([false, true] as $enabled) {
        foreach ([
            new \Plugins\Jwsoft\TiptapEditor\Http\Requests\ImageUploadRequest(),
            new \Plugins\Jwsoft\TiptapEditor\Http\Requests\BeginMediaUploadRequest(),
        ] as $request) {
            if ($request->authorize() !== $enabled) {
                throw new \RuntimeException('Upload setting must be enforced by the server request.');
            }
        }
    }
    echo "[jwsoft] upload settings authorization: 4 cases passed\n";
}
