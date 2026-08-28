<?php

namespace Plugins\Jwsoft\TiptapEditor\Console\Commands;

use Illuminate\Console\Command;
use Plugins\Jwsoft\TiptapEditor\Services\MediaUploadService;

class PruneMediaUploadSessionsCommand extends Command
{
    protected $signature = 'jwsoft-tiptap-editor:prune-media-sessions {--limit=200 : 회차당 최대 세션 수}';

    protected $description = '만료된 MP4 청크 업로드 세션을 정리합니다.';

    public function __construct(private readonly MediaUploadService $service)
    {
        parent::__construct();
    }

    public function handle(): int
    {
        $result = $this->service->pruneExpired(max(1, (int) $this->option('limit')));
        $this->info(sprintf(
            'MP4 업로드 세션 정리: 후보 %d건, 삭제 %d건, 실패 %d건.',
            $result['scanned'],
            $result['deleted'],
            $result['failed'],
        ));

        return $result['failed'] > 0 ? self::FAILURE : self::SUCCESS;
    }
}
