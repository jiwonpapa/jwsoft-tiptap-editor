<?php

namespace Plugins\Jwsoft\TiptapEditor\Console\Commands;

use Illuminate\Console\Command;
use Plugins\Jwsoft\TiptapEditor\Services\ImageCleanupService;

class PruneUnusedImagesCommand extends Command
{
    protected $signature = 'jwsoft-tiptap-editor:prune-unused-images
        {--dry-run : 삭제 없이 후보만 확인}
        {--limit=200 : 회차당 최대 후보 수}
        {--days= : 보존기간 재정의}
        {--scheduled : 스케줄러 호출 표시}';

    protected $description = '미참조 에디터 업로드 이미지를 정리합니다.';

    public function __construct(private readonly ImageCleanupService $cleanup)
    {
        parent::__construct();
    }

    public function handle(): int
    {
        if ($this->option('scheduled') && ! (bool) plugin_setting('jwsoft-tiptap-editor', 'unusedImageCleanup', false)) {
            $this->info('미사용 이미지 자동 정리가 꺼져 있습니다.');

            return self::SUCCESS;
        }

        $daysOption = $this->option('days');
        $days = $daysOption === null || $daysOption === ''
            ? (int) plugin_setting('jwsoft-tiptap-editor', 'unusedImageRetentionDays', 30)
            : (int) $daysOption;
        $result = $this->cleanup->pruneUnused(max(1, $days), max(1, (int) $this->option('limit')), (bool) $this->option('dry-run'));

        if (($result['skipped_reason'] ?? null) === 'sources_incomplete') {
            $this->warn('비활성 모듈로 참조 소스가 불완전하여 실제 삭제를 건너뛰었습니다.');

            return self::SUCCESS;
        }

        $this->info(sprintf(
            '%s 후보 %d건, 참조 %d건, 삭제 %d건, 실패 %d건.',
            $this->option('dry-run') ? '[DRY RUN]' : '정리 완료:',
            $result['scanned'],
            $result['referenced'],
            $result['deleted'],
            $result['failed'],
        ));

        if ($this->option('dry-run') && $result['items'] !== []) {
            $this->table(['ID', 'HASH', '원본명', '크기', '상태'], array_map(
                fn (array $item): array => [$item['id'], $item['hash'], $item['original_name'], $item['file_size'], $item['status']],
                $result['items'],
            ));
        }

        return self::SUCCESS;
    }
}
