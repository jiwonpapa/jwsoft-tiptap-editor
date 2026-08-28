<?php

namespace Plugins\Jwsoft\TiptapEditor\ValueObjects;

final class SanitizationResult
{
    public function __construct(
        public readonly string $canonicalHtml,
        public readonly bool $changed,
    ) {}
}
