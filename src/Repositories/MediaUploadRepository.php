<?php

namespace Plugins\Jwsoft\TiptapEditor\Repositories;

use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Plugins\Jwsoft\TiptapEditor\Models\JwsoftTiptapMediaUpload;
use Plugins\Jwsoft\TiptapEditor\Models\JwsoftTiptapMediaUploadSession;
use Plugins\Jwsoft\TiptapEditor\Repositories\Contracts\MediaUploadRepositoryInterface;

class MediaUploadRepository implements MediaUploadRepositoryInterface
{
    public function __construct(
        private readonly JwsoftTiptapMediaUpload $upload,
        private readonly JwsoftTiptapMediaUploadSession $session,
    ) {}

    public function createSession(array $data): JwsoftTiptapMediaUploadSession
    {
        return $this->session->newQuery()->create($data);
    }

    public function findSessionByToken(string $token): ?JwsoftTiptapMediaUploadSession
    {
        return $this->session->newQuery()->where('token', $token)->first();
    }

    public function recordPart(string $token, int $part, string $checksum): ?JwsoftTiptapMediaUploadSession
    {
        return DB::transaction(function () use ($token, $part, $checksum): ?JwsoftTiptapMediaUploadSession {
            $session = $this->session->newQuery()->where('token', $token)->lockForUpdate()->first();
            if (! $session instanceof JwsoftTiptapMediaUploadSession || $session->status !== 'pending') {
                return null;
            }
            $received = $session->received_parts;
            $received[(string) $part] = $checksum;
            $session->forceFill(['received_parts' => $received])->save();

            return $session->fresh();
        });
    }

    public function claimForCompletion(string $token): ?JwsoftTiptapMediaUploadSession
    {
        return DB::transaction(function () use ($token): ?JwsoftTiptapMediaUploadSession {
            $session = $this->session->newQuery()->where('token', $token)->lockForUpdate()->first();
            if (! $session instanceof JwsoftTiptapMediaUploadSession || $session->status !== 'pending') {
                return null;
            }
            $session->forceFill(['status' => 'assembling'])->save();

            return $session->fresh();
        });
    }

    public function restorePending(JwsoftTiptapMediaUploadSession $session): void
    {
        $session->forceFill(['status' => 'pending'])->save();
    }

    public function deleteSession(JwsoftTiptapMediaUploadSession $session): bool
    {
        return (bool) $session->delete();
    }

    public function findExpiredSessions(Carbon $now, int $limit): Collection
    {
        return $this->session->newQuery()
            ->where('expires_at', '<=', $now)
            ->orderBy('expires_at')->orderBy('id')
            ->limit($limit)->get();
    }

    public function createUpload(array $data): JwsoftTiptapMediaUpload
    {
        return $this->upload->newQuery()->create($data);
    }

    public function findUploadByHash(string $hash): ?JwsoftTiptapMediaUpload
    {
        return $this->upload->newQuery()->where('hash', $hash)->first();
    }
}
