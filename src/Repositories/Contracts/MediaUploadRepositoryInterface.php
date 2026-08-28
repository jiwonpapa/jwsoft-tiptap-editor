<?php

namespace Plugins\Jwsoft\TiptapEditor\Repositories\Contracts;

use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Carbon;
use Plugins\Jwsoft\TiptapEditor\Models\JwsoftTiptapMediaUpload;
use Plugins\Jwsoft\TiptapEditor\Models\JwsoftTiptapMediaUploadSession;

interface MediaUploadRepositoryInterface
{
    public function createSession(array $data): JwsoftTiptapMediaUploadSession;
    public function findSessionByToken(string $token): ?JwsoftTiptapMediaUploadSession;
    public function recordPart(string $token, int $part, string $checksum): ?JwsoftTiptapMediaUploadSession;
    public function claimForCompletion(string $token): ?JwsoftTiptapMediaUploadSession;
    public function restorePending(JwsoftTiptapMediaUploadSession $session): void;
    public function deleteSession(JwsoftTiptapMediaUploadSession $session): bool;
    public function findExpiredSessions(Carbon $now, int $limit): Collection;
    public function createUpload(array $data): JwsoftTiptapMediaUpload;
    public function findUploadByHash(string $hash): ?JwsoftTiptapMediaUpload;
}
