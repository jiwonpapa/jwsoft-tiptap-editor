# MVP 구현 작업 분해

각 단계는 앞 단계의 계약과 테스트를 먼저 작성합니다.

## Epic 0 — 환경 완료

- [x] 독립 저장소
- [x] 헌법과 제품 문서
- [x] dependency locks
- [x] policy schema와 초안
- [x] CI·build·package·deploy 골격
- [x] parity checklist

## Epic 1 — G7 editor adapter

- [ ] `html_editor`/`html_content` extension JSON
- [ ] lifecycle handler와 instance registry
- [ ] props·다국어·readOnly·state sync
- [ ] CKEditor 충돌 detector
- [ ] extension layout tests

## Epic 2 — Tiptap core

- [ ] starter schema
- [ ] toolbar profiles
- [ ] table/image/link dialogs
- [ ] class-token extensions
- [ ] paste/legacy loss analysis
- [ ] IME·keyboard·mobile tests

## Epic 3 — 서버 정책

- [ ] policy codegen
- [ ] Symfony sanitizer service
- [ ] FormRequest와 canonical response
- [ ] 모든 content write path 적용 확인
- [ ] security corpus

## Epic 4 — 이미지 parity

- [ ] upload model/migration/repository/service
- [ ] StorageInterface·serve
- [ ] settings·permission·menu
- [ ] admin list/delete
- [ ] cleanup scheduler와 hooks
- [ ] G7MediaBooster 소비 가능 hook contract

## Epic 5 — 통합·전환

- [ ] board/ecommerce/page E2E
- [ ] legacy CKEditor HTML corpus
- [ ] install/update/deactivate/rollback
- [ ] performance/memory budget
- [ ] parity evidence generator

## Epic 6 — 출시

- [ ] 라이선스 결정
- [ ] third-party notices
- [ ] stable package reproducibility
- [ ] staging 검증
- [ ] GitHub public/release 여부 승인
