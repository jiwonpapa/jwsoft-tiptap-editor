<?php

namespace Plugins\Jwsoft\TiptapEditor\Exceptions;

use RuntimeException;

final class PolicyViolationException extends RuntimeException
{
    public function __construct(
        public readonly string $reasonCode,
        string $message,
    ) {
        parent::__construct($message);
    }
}
