<?php

namespace Plugins\Jwsoft\TiptapEditor\Policy;

use JsonException;
use Plugins\Jwsoft\TiptapEditor\Generated\EditorPolicy;
use RuntimeException;

final class EditorPolicyLoader
{
    private readonly string $policyFile;

    public function __construct(?string $policyFile = null)
    {
        $this->policyFile = $policyFile
            ?? dirname(__DIR__, 2).'/policy/editor-policy.json';
    }

    /** @return array<string, mixed> */
    public function load(): array
    {
        $source = @file_get_contents($this->policyFile);
        if (! is_string($source)) {
            throw new RuntimeException('Editor policy 파일을 읽을 수 없습니다.');
        }

        if (! hash_equals(EditorPolicy::SHA256, hash('sha256', $source))) {
            throw new RuntimeException('Editor policy와 생성 코드의 checksum이 다릅니다.');
        }

        try {
            $policy = json_decode($source, true, flags: JSON_THROW_ON_ERROR);
        } catch (JsonException $exception) {
            throw new RuntimeException('Editor policy JSON이 올바르지 않습니다.', 0, $exception);
        }

        if (! is_array($policy) || $policy !== EditorPolicy::POLICY) {
            throw new RuntimeException('Editor policy 생성물이 현재 정책과 일치하지 않습니다.');
        }

        return $policy;
    }
}
