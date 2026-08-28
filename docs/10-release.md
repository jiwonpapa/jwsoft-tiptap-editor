# 릴리스 체크리스트

## 코드

- [x] 헌법 위반 없음
- [x] CHANGELOG와 버전 동기화
- [x] G7 최소 버전 근거
- [x] 공개 API·훅·설정 문서

## 품질

- [ ] `make release-check` stable gate
- [x] `make release-candidate-check` alpha gate
- [x] npm/composer audit
- [x] MVP parity evidence 100%
- [x] legacy loss report 검증
- [ ] staging install/update/rollback

GitHub `Release gate`는 `self-hosted`, `linux`, `g7-integration` 라벨을 가진 격리 러너에서만 실행합니다. 저장소 변수 `G7_INTEGRATION_ROOT`와 `G7_INTEGRATION_URL`을 설정하고, 테스트가 같은 실행 안에서 parity evidence를 생성해야 합니다. 일반 CI 결과만으로 릴리스하지 않습니다.

## 패키지

- [x] dist, vendor, manifest, resources 포함
- [x] 개발 fixture·비밀·node_modules 제외
- [x] SHA256SUMS
- [x] 동일 commit 2회 ZIP checksum 일치
- [x] 전용 G7 ZIP 업데이트·롤백·복구 검증

MVP 6 개발 하네스에서는 `alpha.7` ZIP을 같은 commit epoch로 두 번 생성해 checksum 일치를 확인하고, `alpha.6 → alpha.7 → CKEditor → alpha.7` 생명주기와 콘텐츠 해시 보존을 검증합니다. UI 브라우저 증거는 5차 `alpha.6` 관측임을 provenance에 유지하며 6차의 새 브라우저 실행으로 승격하지 않습니다. `make release-candidate-check`는 현재 MVP 후보 게이트이며 실제 staging을 대체하지 않습니다. `make release-check`는 전체 P0 체크리스트가 남아 있는 동안 의도적으로 실패합니다.

## 공개

- [x] 제품 라이선스 결정: Proprietary
- [x] Tiptap·ProseMirror·DOMPurify·Symfony NOTICE와 원문 라이선스 포함
- [ ] GitHub visibility 승인
- [ ] 태그·GitHub release·설치 문서
