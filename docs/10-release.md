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
- [x] 공개 GitHub URL 최초 설치·Release 태그 업데이트·무데이터 삭제 uninstall 검증

현재 개발 하네스에서는 `alpha.12` ZIP을 같은 commit epoch로 두 번 생성해 checksum 일치를 확인하고, `alpha.11 → alpha.12 → CKEditor → alpha.12` 생명주기와 콘텐츠 해시 보존을 검증합니다. UI 브라우저 증거는 현재 `alpha.12` commit의 인증 G7 9개 화면, route-to-editor p95 1,083ms, 최대 동시 instance 1개를 기록합니다. `make release-candidate-check`는 22개 후보 계약을 검사하며 실제 staging을 대체하지 않습니다. `make release-check`는 P0 62개 중 자동화 증거가 연결된 항목과 남은 차단 항목을 분리해 보고하고, 미완료가 있는 동안 의도적으로 실패합니다.

## 공개

- [x] 제품 라이선스 결정: Proprietary
- [x] Tiptap·ProseMirror·DOMPurify·Symfony NOTICE와 원문 라이선스 포함
- [x] GitHub visibility 승인 및 public 전환
- [x] 공개 `main` GitHub 온라인 설치 원본·설치 문서
- [ ] stable 태그·GitHub release
