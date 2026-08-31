# 테스트 전략

## Enter·공식 SNS 회귀

`formSubmitGuard.test.ts`와 `editor-ui.spec.ts`는 제목 Enter의 미처리 GET 차단·제목 보존·본문 필수 안내와 기존 저장 버튼 키보드 동작을 확인합니다. 실제 로그인 공개/관리자 작성은 별도 G7 검사입니다.

`socialPolicy.test.ts`, 서버 링크 미리보기 통합 검사와 `social-embeds.spec.ts`는 URL 화이트리스트·공통 표시·저장 정본·OFF·click 전 연결 없음·실패 재시도를 검사합니다. 기본 E2E는 제공자 SDK 모형을 사용합니다. `JWSOFT_LIVE_SOCIAL=1 npx playwright test tests/e2e/social-embeds.spec.ts --grep 'live official'`은 실제 제공자의 본문·이미지 표시를 추가로 검사하며 비공개/삭제 오류를 성공으로 인정하지 않습니다. 제공자 정책 변경이나 테스트 게시물 삭제로 실패하면 결과를 숨기거나 성공 기준을 낮추지 않습니다.

## G7 본문 동기화 회귀

`node tests/integration/g7_state_sync_test.mjs "$G7_ROOT"`는 지정한 전용 G7의 실제 실행 번들·기본 게시판 저장 시퀀스와 현재 에디터 소스를 함께 실행합니다. 신규·수정·다국어 본문의 화면 너비 변경 및 입력 직후 저장에서 제출 값이 에디터 HTML과 같은지 확인합니다. 선택 위치·에디터 instance 유지와 다른 언어 본문 보존도 검사하며 `make integration-check`에 포함됩니다.

이 검사는 네트워크·인증·DB 쓰기 없이 실행되는 DOM 통합 검사입니다. 실제 사이트의 인증 저장·재조회나 실기기 검증을 대신하지 않습니다.

## 피라미드

### Unit

- token command와 schema
- policy parser와 codegen
- canonical HTML serializer
- class·URL·media validation
- G7 state adapter

### PHP contract

- policy checksum과 sanitizer service
- 게시판 4개·상품 설명 3개·상품 공통정보 2개·페이지 2개 편집 write route middleware 선언
- FormRequest
- image upload/serve/cleanup
- MP4 chunk checksum/retry/assembly/serve/session cleanup
- link preview provider/metadata/redirect/SSRF/body limit and canonical card
- repository와 StorageInterface
- permission, hook, settings schema

### Integration

- G7 plugin install/activate/deactivate/update
- extension point 주입
- state submit과 API 저장
- legacy HTML round-trip

`make integration-check`는 전용 G7 7.0.9+의 플러그인 명령 계약, 모든 `html_editor` 교체 저장 route 11개 존재, Illuminate Request 기반 문자열·다국어 map HTML 정제와 직접 우회 요청 차단, 이미지 업로드의 신·구 훅 발화·StorageInterface 저장·DB 실패 롤백·고아 레코드 정리를 검사합니다. 관리자 이미지 검사는 G7 layout 구조, 인증·조회/삭제 권한 route, 실제 SQLite 목록 pagination·공식 편집 화면 참조 판정·단건/일괄 파일 및 레코드 삭제·경합으로 사라진 ID 보고까지 포함합니다. MP4 청크 해시·멱등 재시도·조립·서빙·만료 정리와 링크 미리보기 provider·metadata·redirect·SSRF gate도 같은 단계에서 검사합니다. 별도 lifecycle 하네스는 실제 ZIP 업데이트, 동시 활성화 차단, CKEditor 롤백·JWSoft 복구와 페이지·게시글·상품 DB 해시 보존을 기록합니다.

### Browser E2E

- 게시판, 상품, 페이지
- 다국어, 모바일, 다크모드
- paste, IME, keyboard
- 이미지와 표
- 전환·롤백

독립 Chromium 검사는 데스크톱 선택 영역 서식·키보드 포커스·링크·인용·목록·정렬·들여쓰기, mock API 이미지 업로드와 caption·정렬·크기 재편집 및 412px 반응형 출력, 화면 이동 100회의 mount/unmount instance 회수, Pixel 7 viewport의 삽입 도구 접힘·가로 넘침 없음·하단 시트·대화상자 폭을 검증합니다. `Input.imeSetComposition`은 JS 합성 이벤트가 아닌 Chromium 입력 계층에서 한글 composition을 발생시키며, 신뢰된 loopback origin의 Clipboard API·붙여넣기 단축키·툴바와 키보드 undo/redo를 함께 검사합니다. 공개 `alpha.18`은 실제 인증 G7에서 공개·관리자 게시판 작성/재편집·답글, 상품·페이지 작성/재편집·공개 출력, 한국어·영어 UI, 접근성 이름, 단일 instance, 412px 다크 테마와 direct `HtmlEditor` fallback을 screenshot·JSON으로 기록했습니다. G7 공개 renderer는 자신의 API를 HTTP로 호출하므로 단일 프로세스 개발 서버가 아닌 2개 이상 worker와 fresh cache key로 검증합니다. Android/iOS 물리 키보드 입력은 아직 관측하지 않았으며 별도 실기기 증거로 분리합니다.

## 증거 파일

`test-results/parity/evidence.json`은 browser, corpus, integration, lifecycle, performance, supply-chain 하위 증거가 모두 통과하고 커밋된 clean tree일 때만 생성되며 다음을 포함합니다.

- plugin/G7/git version
- artifact SHA256
- 실행 시각·환경
- 동등성 항목 ID와 결과
- 브라우저·viewport
- 실패 시 screenshot/trace 경로

`test-results/parity/unit.json`은 Vitest 기본 출력과 함께 생성되는 구조화 결과이며 전체 테스트 수와 assertion 상태를 보존합니다. `test-results/parity/browser/instance-lifecycle.json`은 Chromium 화면 이동 100회에서 분리 후 instance 0, 재마운트 후 instance 1, 최종 instance 0을 기록하고, `editor-indentation.json`은 구조 편집, `editor-image-layout.json`은 업로드·caption·정렬·크기·모바일 폭과 inline style 0을 기록합니다. `editor-ime.json`은 composition 이벤트·브라우저 clipboard·정제·undo/redo·G7 debounce 상태와 screenshot checksum을 기록하되 Android/iOS 실기기 미관측 경계를 명시합니다. `test-results/parity/integration.json`은 미들웨어·이미지·MP4·링크 미리보기 G7 통합 검사의 파일 checksum을 모두 기록합니다. stable readiness는 체크 표시만 신뢰하지 않고 각 완료 항목의 `p0` ID와 `harness/contracts/stable-readiness.json`의 증거 경로를 대조합니다.

`scripts/g7-github-lifecycle-evidence.sh`는 공개 `main` commit과 현재 checkout이 같은 경우에만 전용 local G7에서 GitHub 최초 설치, 이전 ZIP 설치, 최신 GitHub Release 태그 업데이트, 무데이터 삭제 uninstall, CKEditor 롤백과 JWSoft 복구를 실행합니다. 최초 설치는 릴리스가 없으면 `main` source archive로 폴백할 수 있지만 G7 GitHub 업데이트는 대상 버전의 태그가 반드시 필요합니다. 이 검사는 실제 네트워크와 공개 GitHub source archive를 사용하지만 외부 staging 배포를 대체하지 않습니다.

`test-results/release/reproducibility.json`은 같은 source commit epoch에서 ZIP을 두 번 생성한 checksum 일치를 기록합니다. `test-results/release/license.json`은 제품 라이선스, lockfile의 런타임 라이선스, ZIP 안의 NOTICE·원문 라이선스를 검사합니다. 두 파일은 로컬 증거이며 staging 승인 기록이 아닙니다.

수동 체크만으로 evidence를 만들면 안 됩니다. 실제 브라우저 화면은 Playwright CLI screenshot의 SHA256, 레코드 ID, 관측 플러그인 버전과 source commit을 함께 기록합니다. 출시 후보의 패키지 버전과 브라우저 관측 버전이 다르면 통합 증거에 두 경계를 각각 남기며, 새 브라우저 검증으로 오해하지 않습니다.

### 최신 증거 판정

- `make check`가 모두 성공한 뒤 `checks.json`에 소스·테스트·설정·패키지 입력 fingerprint와 unit/corpus 결과 파일 해시를 기록합니다. 결과나 입력이 변경되면 재검사가 필요합니다. acceptance 문서만 바꾸는 커밋은 테스트를 무효화하지 않지만 ZIP에 들어가는 CHANGELOG·LICENSE·NOTICE 변경은 반영합니다.
- G7 통합 검사는 같은 입력 fingerprint와 필수 6개 테스트의 고유 파일·해시를 요구합니다.
- 독립 UI 검사는 실제 로드한 `dist/js/plugin.iife.js` 해시를 기록합니다. G7 모바일·다크·다국어 관찰 기록 명령에는 관찰한 응답 번들의 `--runtime-sha256`을 전달해야 합니다. 툴바와 페이지의 가로 넘침이 있으면 통과하지 않습니다.
- 실제 G7 저장·출력 화면과 설치·업데이트·롤백 증거는 현재 버전과 재현 ZIP checksum을 요구합니다. 화면 파일이 누락·변조되었거나 저장소 밖을 가리키면 차단합니다.
- 패키지 증거는 두 번의 빌드, 입력 fingerprint, 실행 번들 해시, 실제 ZIP 파일 해시를 대조합니다. 소스 전용 라이선스 검사는 패키지 라이선스 승인으로 인정하지 않습니다.
- stable gate는 누락·오래된 증거를 항목별 `reasons`로 기록하고, dirty worktree도 별도 차단합니다. unit 테스트용 합성 증거는 임시 디렉터리에서만 만들고 실제 `test-results`에 기록하지 않습니다.

`node scripts/stable-evidence-test.mjs`는 오래된 버전·같은 버전의 다른 번들·다른 ZIP·변경된 screenshot·경로 탈출·중복 통합 검사·production/staging checksum 불일치의 거부를 검사합니다. 이 회귀 검사는 제품 기능이나 실제 배포 smoke를 대신하지 않습니다.

ADR 0012 이후 `stable-readiness-gate.mjs --phase=candidate|predeploy|production|final`은 동일한 62개 계약을 57/60/61/62개의 필수 증거로 나누고 아직 검사하지 않은 항목을 `deferred`로 표시합니다. 기본값은 전체 `final`이며 검사 제외를 pass로 계산하지 않습니다. `release-phases-test.mjs`는 정확한 분리와 alpha/beta 운영 금지, 원격 변경 전 gate 순서를 검사합니다. production 검증은 동일 staging 파일의 해시, 버전·ZIP, 적용 시각 순서와 같은 대상의 명시적 승인을 요구합니다.

## 보안 corpus

각 payload를 다음 네 경로로 실행합니다.

1. 초기 HTML load
2. clipboard paste
3. API 직접 submit
4. 저장 후 render

저장 HTML, 브라우저 실행 여부, 제거/거부 사유를 모두 검사합니다.

## 성능

- clean profile cold start
- warm repeat
- 100KB/1MB 문서
- 100행 표와 다중 이미지
- editor mount/unmount 100회 메모리 누수

성능 기준은 hardware·browser·G7 commit과 함께 기록합니다.
