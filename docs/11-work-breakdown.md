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

- [x] `html_editor`/`html_content` extension JSON
- [x] lifecycle handler와 instance registry
- [x] props·다국어·readOnly·state sync
- [x] CKEditor 충돌 detector
- [x] extension contract와 adapter unit tests

Epic 3의 게시판 저장 sanitizer가 연결된 뒤 write gate를 열었습니다. 전용 G7 7.0.9+ 호스트의 integration evidence가 생성되기 전에는 parity 완료로 판정하지 않습니다.

## Epic 2 — Tiptap core

- [x] starter schema
- [x] toolbar profiles
- [x] table/image URL/link dialogs
- [x] class-token extensions
- [x] 초기 HTML policy·schema 손실 분석과 명시적 확인
- [x] clipboard paste 손실 분석과 실행취소 안내
- [x] 선택 영역 unit·toolbar keyboard·mobile viewport browser tests
- [ ] 실제 한글 IME·Android/iOS 실기기 tests

## Epic 3 — 서버 정책

- [x] policy codegen과 checksum gate
- [x] Symfony sanitizer service와 canonical response
- [x] G7 게시판 사용자·관리자 create/update 미들웨어
- [ ] 쇼핑몰·페이지를 포함한 모든 content write path 적용 확인
- [x] PHP·브라우저·G7 직접 제출 security corpus
- [ ] clipboard paste·저장 후 render security corpus

## Epic 4 — 이미지 parity

- [x] upload model/migration/repository/service
- [x] StorageInterface·serve
- [x] settings·permission·menu
- [x] admin list/delete
- [x] cleanup scheduler와 hooks
- [x] G7MediaBooster 소비 가능 hook contract

4차 구현·단위·G7 클래스 통합 게이트에 이어 5차 전용 하네스에서 실제 마이그레이션·권한·인증 관리 화면을 확인했습니다.

## Epic 5 — 통합·전환

- [x] board/ecommerce/page E2E
- [x] legacy CKEditor HTML corpus
- [x] install/update/deactivate/rollback
- [x] performance/instance budget
- [x] parity evidence generator

전용 G7 7.0.9에서 alpha.5 → alpha.6 ZIP 업데이트와 CKEditor 역전환·복구를 실행했고, 페이지·게시글·상품 HTML 해시가 전 과정에서 유지됨을 확인했습니다. 인증 브라우저 5회 표본은 route-to-editor p95 1,227ms, 동시 editor instance 1개였고 번들 gzip은 162,061 bytes였습니다. 이 결과는 MVP 5 계약 범위이며 stable 출시 승인은 아닙니다.

## Epic 6 — 출시

- [x] Proprietary 제품 라이선스 결정
- [x] third-party notices와 런타임 원문 라이선스 패키징
- [x] alpha release-candidate package reproducibility
- [ ] staging 검증
- [ ] GitHub public/release 여부 승인

6차는 `alpha.7`을 같은 commit epoch로 두 번 패키징해 동일 checksum을 확인했습니다. 전용 로컬 G7 7.0.9에서 alpha.6 → alpha.7 업데이트, CKEditor 롤백, JWSoft 복구와 페이지·게시글·상품 정본 해시 보존도 통과했습니다. 실제 staging 환경 파일과 배포 승인이 없으므로 staging·stable·공개 릴리스는 진행하지 않았습니다.
