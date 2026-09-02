# 릴리스 체크리스트

## 현재 마감 순서 (ADR-0017)

기준은 총 62개로 고정합니다. 같은 코드·패키지의 유효한 증거를 재사용하며 새 버전이나 변경 입력에 이전 결과를 붙이지 않습니다.

1. 후보 57개 통과 후 `publish-candidate`의 명시 적용으로 검증 후보 Latest를 공개합니다. 다른 사이트의 업데이트 확인에도 노출되며 최종 승인 전임을 표시합니다.
2. 전용 G7에서 실제 GitHub 설치·업데이트·데이터 보존 제거 3개를 확인합니다 (60개).
3. 승인 대상에 같은 ZIP으로 staging 적용·smoke (61개), production 적용·checksum 확인 (62개)을 수행합니다.
4. `publish-stable`로 현재 62개와 원격 ZIP을 확인한 뒤 같은 릴리스의 최종 승인 표시만 갱신합니다. 후보 파일을 재빌드·교체하지 않습니다.

GitHub workflow는 수동 검증 전용이며 태그 푸시로 게시하지 않습니다. 아래 과거 체크 표시는 현재 버전의 통과 증거가 아닙니다.

## 코드

- [x] 헌법 위반 없음
- [x] CHANGELOG와 버전 동기화
- [x] G7 최소 버전 근거
- [x] 공개 API·훅·설정 문서

## 품질

- [ ] `make release-check` stable gate
- [ ] 현재 RC의 `make release-candidate-check` 57개 gate
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

- [x] 제품 라이선스 결정: Apache-2.0 (ADR-0015)
- [x] Tiptap·ProseMirror·DOMPurify·Symfony NOTICE와 원문 라이선스 포함
- [x] GitHub visibility 승인 및 public 전환
- [x] 공개 `main` GitHub 온라인 설치 원본·설치 문서
- [x] `v0.1.0-alpha.18` 공개 개발 릴리스와 온라인 설치·업데이트 검증
- [ ] stable 태그·GitHub release

## alpha.21 이후 남은 stable 차단 사항

alpha.21은 공개 alpha와 승인 staging 배포까지 완료했습니다. 최신성 gate 기준으로 남은 화면 증거는 공개 게시판·관리자 게시판·상품·페이지·모바일/다크/다국어·direct HtmlEditor 6종이며, production 대상 확인과 동일 checksum 적용이 별도로 필요합니다. 이전 버전의 화면 JSON을 최신 버전으로 바꿔 기록하지 않습니다.

2026-08-30 제품 소유자의 명시적 승인에 따라 [ADR 0012](adr/0012-phased-release-promotion.md)와 헌법 제10조를 개정했습니다. 현재 후보는 `0.1.0-rc.1`이며 후보 공개 전 57개 → GitHub 수명주기 포함 60개 → staging 포함 61개 → 동일 ZIP production 이후 62개로 검증합니다. 이는 완료 선언이 아니며 각 단계의 최신 증거가 있어야 통과합니다. 같은 서버 사용 승인은 환경 격리 검증을 의미하지 않습니다. RC의 전체 통과도 `0.1.0` 버전 검증으로 표현하지 않습니다.
