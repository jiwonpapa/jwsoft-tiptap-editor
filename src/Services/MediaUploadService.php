<?php

namespace Plugins\Jwsoft\TiptapEditor\Services;

use App\Contracts\Extension\StorageInterface;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Log;
use Plugins\Jwsoft\TiptapEditor\Exceptions\MediaUploadException;
use Plugins\Jwsoft\TiptapEditor\Models\JwsoftTiptapMediaUpload;
use Plugins\Jwsoft\TiptapEditor\Models\JwsoftTiptapMediaUploadSession;
use Plugins\Jwsoft\TiptapEditor\Repositories\Contracts\MediaUploadRepositoryInterface;
use Throwable;

class MediaUploadService
{
    private const SESSION_HOURS = 24;
    private const MIN_CHUNK_BYTES = 1024 * 1024;
    private const MAX_CHUNK_BYTES = 10 * 1024 * 1024;

    public function __construct(
        private readonly MediaUploadRepositoryInterface $repository,
        private readonly StorageInterface $storage,
    ) {}

    public function begin(
        string $originalName,
        int $fileSize,
        ?int $uploadedBy,
        int $maxSizeMb,
        int $chunkSizeMb,
    ): JwsoftTiptapMediaUploadSession {
        $maximum = max(1, min(500, $maxSizeMb)) * 1024 * 1024;
        if ($fileSize < 8 || $fileSize > $maximum || ! preg_match('/\.mp4$/i', $originalName)) {
            throw new MediaUploadException('media_metadata_rejected');
        }

        $configuredChunkSize = max(1, min(10, $chunkSizeMb)) * 1024 * 1024;
        $chunkSize = min($fileSize, max(self::MIN_CHUNK_BYTES, min(self::MAX_CHUNK_BYTES, $configuredChunkSize)));

        return $this->repository->createSession([
            'token' => bin2hex(random_bytes(16)),
            'original_name' => $this->safeOriginalName($originalName),
            'file_size' => $fileSize,
            'chunk_size' => $chunkSize,
            'total_parts' => (int) ceil($fileSize / $chunkSize),
            'received_parts' => [],
            'status' => 'pending',
            'uploaded_by' => $uploadedBy,
            'expires_at' => Carbon::now()->addHours(self::SESSION_HOURS),
        ]);
    }

    public function status(string $token, ?int $uploadedBy): JwsoftTiptapMediaUploadSession
    {
        $session = $this->requirePendingSession($token, $uploadedBy);

        return $session;
    }

    public function storePart(
        string $token,
        int $part,
        UploadedFile $chunk,
        string $checksum,
        ?int $uploadedBy,
    ): JwsoftTiptapMediaUploadSession {
        $session = $this->requirePendingSession($token, $uploadedBy);
        if ($part < 0 || $part >= (int) $session->total_parts || ! preg_match('/^[a-f0-9]{64}$/', $checksum)) {
            throw new MediaUploadException('media_part_rejected');
        }
        $path = $chunk->getRealPath();
        $actualBytes = is_string($path) && is_file($path) ? filesize($path) : false;
        $expectedBytes = $part === ((int) $session->total_parts - 1)
            ? (int) $session->file_size - ((int) $session->chunk_size * $part)
            : (int) $session->chunk_size;
        if (! is_int($actualBytes) || $actualBytes !== $expectedBytes || hash_file('sha256', $path) !== $checksum) {
            throw new MediaUploadException('media_part_rejected');
        }

        $received = is_array($session->received_parts) ? $session->received_parts : [];
        $partPath = $this->partPath($token, $part);
        if (($received[(string) $part] ?? null) === $checksum && $this->storage->exists('media-temp', $partPath)) {
            return $session;
        }
        if (isset($received[(string) $part]) && $received[(string) $part] !== $checksum) {
            throw new MediaUploadException('media_part_conflict');
        }

        $stream = fopen($path, 'rb');
        if ($stream === false) {
            throw new MediaUploadException('media_part_rejected');
        }
        try {
            $stored = $this->storage->put('media-temp', $partPath, $stream);
        } finally {
            fclose($stream);
        }
        if (! $stored) {
            throw new MediaUploadException('media_storage_failed');
        }

        try {
            $updated = $this->repository->recordPart($token, $part, $checksum);
        } catch (Throwable $exception) {
            $this->storage->delete('media-temp', $partPath);
            throw $exception;
        }
        if (! $updated instanceof JwsoftTiptapMediaUploadSession) {
            $this->storage->delete('media-temp', $partPath);
            throw new MediaUploadException('media_session_conflict');
        }

        return $updated;
    }

    public function complete(string $token, ?int $uploadedBy): JwsoftTiptapMediaUpload
    {
        $candidate = $this->requirePendingSession($token, $uploadedBy);
        $received = is_array($candidate->received_parts) ? $candidate->received_parts : [];
        if (count($received) !== (int) $candidate->total_parts) {
            throw new MediaUploadException('media_parts_missing');
        }

        $session = $this->repository->claimForCompletion($token);
        if (! $session instanceof JwsoftTiptapMediaUploadSession) {
            throw new MediaUploadException('media_session_conflict');
        }

        $temporary = tmpfile();
        if ($temporary === false) {
            $this->repository->restorePending($session);
            throw new MediaUploadException('media_assembly_failed');
        }

        $finalPath = '';
        $record = null;
        try {
            $written = $this->assemble($session, $temporary);
            $meta = stream_get_meta_data($temporary);
            $temporaryPath = $meta['uri'] ?? null;
            if ($written !== (int) $session->file_size || ! is_string($temporaryPath)) {
                throw new MediaUploadException('media_assembly_failed');
            }
            $this->validateMp4($temporaryPath, $written);
            rewind($temporary);

            $finalPath = date('Y/m/d').'/'.bin2hex(random_bytes(16)).'.mp4';
            if (! $this->storage->put('media', $finalPath, $temporary)) {
                throw new MediaUploadException('media_storage_failed');
            }
            try {
                $record = $this->repository->createUpload([
                    'original_name' => (string) $session->original_name,
                    'file_path' => 'media/'.$finalPath,
                    'storage_disk' => $this->storage->getDisk(),
                    'file_size' => $written,
                    'mime_type' => 'video/mp4',
                    'uploaded_by' => $session->uploaded_by,
                ]);
            } catch (Throwable $exception) {
                $this->storage->delete('media', $finalPath);
                throw $exception;
            }
        } catch (Throwable $exception) {
            $this->repository->restorePending($session);
            throw $exception;
        } finally {
            fclose($temporary);
        }

        if ($this->storage->deleteDirectory('media-temp', $this->sessionDirectory($token))) {
            $this->repository->deleteSession($session);
        } else {
            Log::warning('JWSoft Tiptap 완료된 MP4 임시 청크 정리 실패', ['token' => $token]);
        }

        return $record;
    }

    public function cancel(string $token, ?int $uploadedBy): void
    {
        $session = $this->requirePendingSession($token, $uploadedBy, rejectExpired: false);
        if (! $this->storage->deleteDirectory('media-temp', $this->sessionDirectory($token))) {
            throw new MediaUploadException('media_cleanup_failed');
        }
        $this->repository->deleteSession($session);
    }

    /** @return array{scanned: int, deleted: int, failed: int} */
    public function pruneExpired(int $limit): array
    {
        $sessions = $this->repository->findExpiredSessions(Carbon::now(), max(1, min(1000, $limit)));
        $deleted = 0;
        $failed = 0;
        foreach ($sessions as $session) {
            if (! $session instanceof JwsoftTiptapMediaUploadSession) {
                continue;
            }
            if ($this->storage->deleteDirectory('media-temp', $this->sessionDirectory((string) $session->token))
                && $this->repository->deleteSession($session)) {
                $deleted++;
            } else {
                $failed++;
            }
        }

        return ['scanned' => $sessions->count(), 'deleted' => $deleted, 'failed' => $failed];
    }

    /** @param resource $target */
    private function assemble(JwsoftTiptapMediaUploadSession $session, mixed $target): int
    {
        $received = is_array($session->received_parts) ? $session->received_parts : [];
        $written = 0;
        for ($part = 0; $part < (int) $session->total_parts; $part++) {
            $contents = $this->storage->get('media-temp', $this->partPath((string) $session->token, $part));
            if (! is_string($contents)
                || hash('sha256', $contents) !== ($received[(string) $part] ?? null)
                || fwrite($target, $contents) !== strlen($contents)) {
                throw new MediaUploadException('media_assembly_failed');
            }
            $written += strlen($contents);
        }

        return $written;
    }

    private function validateMp4(string $path, int $bytes): void
    {
        $header = file_get_contents($path, false, null, 0, 32);
        $boxSize = is_string($header) && strlen($header) >= 12 ? unpack('N', substr($header, 0, 4))[1] : 0;
        $brand = is_string($header) ? substr($header, 8, 4) : '';
        $mime = (new \finfo(FILEINFO_MIME_TYPE))->file($path);
        if (! is_string($header)
            || substr($header, 4, 4) !== 'ftyp'
            || $boxSize < 12
            || $boxSize > $bytes
            || ! preg_match('/^[A-Za-z0-9 ]{4}$/', $brand)
            || $mime !== 'video/mp4') {
            throw new MediaUploadException('media_file_rejected');
        }
    }

    private function requirePendingSession(
        string $token,
        ?int $uploadedBy,
        bool $rejectExpired = true,
    ): JwsoftTiptapMediaUploadSession {
        $session = preg_match('/^[a-f0-9]{32}$/', $token)
            ? $this->repository->findSessionByToken($token)
            : null;
        if (! $session instanceof JwsoftTiptapMediaUploadSession || $session->status !== 'pending') {
            throw new MediaUploadException('media_session_missing');
        }
        if ($session->uploaded_by !== null && (int) $session->uploaded_by !== $uploadedBy) {
            throw new MediaUploadException('media_session_forbidden');
        }
        if ($rejectExpired && $session->isExpired()) {
            throw new MediaUploadException('media_session_expired');
        }

        return $session;
    }

    private function partPath(string $token, int $part): string
    {
        return $this->sessionDirectory($token).'/'.sprintf('%06d.part', $part);
    }

    private function sessionDirectory(string $token): string
    {
        return 'sessions/'.$token;
    }

    private function safeOriginalName(string $name): string
    {
        $name = preg_replace('/[\x00-\x1F\x7F]/u', '', basename(str_replace('\\', '/', $name))) ?: 'video.mp4';

        return function_exists('mb_substr') ? mb_substr($name, 0, 255) : substr($name, 0, 255);
    }
}
