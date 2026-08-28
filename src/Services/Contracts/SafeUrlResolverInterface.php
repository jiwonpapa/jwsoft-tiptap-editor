<?php

namespace Plugins\Jwsoft\TiptapEditor\Services\Contracts;

interface SafeUrlResolverInterface
{
    /** 공개 IP만 반환하며 안전하게 확인할 수 없으면 예외를 발생시킵니다. */
    public function resolve(string $host): string;
}
