<?php

namespace Plugins\Jwsoft\TiptapEditor\Services;

use DOMDocument;
use RuntimeException;

final class EditorContent
{
    /** Only call after HTML policy sanitization. Required/nullable rules remain owned by G7. */
    public static function normalizeEmpty(string $canonicalHtml): string
    {
        if ($canonicalHtml === '') {
            return '';
        }

        $dom = new DOMDocument('1.0', 'UTF-8');
        $previous = libxml_use_internal_errors(true);
        try {
            if (! $dom->loadHTML('<?xml encoding="UTF-8"><body>'.$canonicalHtml.'</body>', LIBXML_NONET)) {
                throw new RuntimeException('Cannot inspect canonical editor content.');
            }
            // NBSP, zero-width characters and formatting controls are not a body.
            $text = preg_replace('/[\p{Z}\p{C}\x{FE00}-\x{FE0F}]/u', '', $dom->textContent);
            if ($text !== null && $text !== '') {
                return $canonicalHtml;
            }
            foreach ($dom->getElementsByTagName('img') as $image) {
                if ($image->getAttribute('src') !== '') {
                    return $canonicalHtml;
                }
            }

            return '';
        } finally {
            libxml_clear_errors();
            libxml_use_internal_errors($previous);
        }
    }
}
