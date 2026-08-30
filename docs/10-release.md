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

공개 `alpha.18` ZIP은 같은 commit epoch의 두 패키지가 SHA256 `0841149aadcacba18c89da4ba401d0880163cb42611a43f3c5df6a5668ccb8c1`로 일치합니다. 전용 G7 7.0.9에서 ZIP·GitHub 최초 설치, `alpha.16 → alpha.18` 태그 업데이트, uninstall, CKEditor rollback, JWSoft restore와 콘텐츠 해시 보존을 검증했습니다. 당시 UI 브라우저 증거는 게시판·상품·페이지·fallback, route-to-editor 5회 표본 861~1,093ms와 최대 동시 instance 1개를 기록합니다. 이는 최신 checkout의 재검증 결과가 아닙니다. `make release-candidate-check`는 alpha 후보 계약을 검사하며 실제 staging을 대체하지 않습니다. `make stable-readiness-gate`는 현재 입력·번들·ZIP에 맞는 P0 증거만 집계하고, 오래된 증거와 미완료를 차단합니다. 최신 완료 수는 생성된 JSON에서 확인하며 과거 `60/62`를 고정 수치로 재사용하지 않습니다.

## 공개

- [x] 제품 라이선스 결정: Proprietary
- [x] Tiptap·ProseMirror·DOMPurify·Symfony NOTICE와 원문 라이선스 포함
- [x] GitHub visibility 승인 및 public 전환
- [x] 공개 `main` GitHub 온라인 설치 원본·설치 문서
- [x] `v0.1.0-alpha.18` 공개 개발 릴리스와 온라인 설치·업데이트 검증
- [ ] stable 태그·GitHub release
