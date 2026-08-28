# 테스트 전략

## 피라미드

### Unit

- token command와 schema
- policy parser와 codegen
- canonical HTML serializer
- class·URL·media validation
- G7 state adapter

### PHP contract

- policy checksum과 sanitizer service
- 게시판 4개 write route middleware 선언
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

`make integration-check`는 전용 G7 7.0.9+의 플러그인 명령 계약, 실제 Illuminate Request 기반 게시판 HTML 미들웨어, 이미지 업로드의 신·구 훅 발화·StorageInterface 저장·DB 실패 롤백·고아 레코드 정리, MP4 청크 해시·멱등 재시도·조립·서빙·만료 정리, 링크 미리보기 provider·metadata·redirect·SSRF gate를 검사합니다. 별도 lifecycle 하네스는 실제 ZIP 업데이트, 동시 활성화 차단, CKEditor 롤백·JWSoft 복구와 페이지·게시글·상품 DB 해시 보존을 기록합니다.

### Browser E2E

- 게시판, 상품, 페이지
- 다국어, 모바일, 다크모드
- paste, IME, keyboard
- 이미지와 표
- 전환·롤백

독립 Chromium 검사는 데스크톱 선택 영역 서식·키보드 포커스·mock API 이미지 업로드 삽입과 Pixel 7 viewport의 툴바 스크롤·대화상자 폭을 검증합니다. MVP 5는 실제 인증 G7의 게시판·상품·페이지 작성/재편집, 한국어·영어 UI, 접근성 이름과 단일 instance도 screenshot·JSON으로 기록합니다. 실제 한글 IME·Android/iOS 실기기는 release 단계에서 별도 증거를 생성합니다.

## 증거 파일

`test-results/parity/evidence.json`은 browser, corpus, integration, lifecycle, performance, supply-chain 하위 증거가 모두 통과하고 커밋된 clean tree일 때만 생성되며 다음을 포함합니다.

- plugin/G7/git version
- artifact SHA256
- 실행 시각·환경
- 동등성 항목 ID와 결과
- 브라우저·viewport
- 실패 시 screenshot/trace 경로

`test-results/release/reproducibility.json`은 같은 source commit epoch에서 ZIP을 두 번 생성한 checksum 일치를 기록합니다. `test-results/release/license.json`은 제품 라이선스, lockfile의 런타임 라이선스, ZIP 안의 NOTICE·원문 라이선스를 검사합니다. 두 파일은 로컬 증거이며 staging 승인 기록이 아닙니다.

수동 체크만으로 evidence를 만들면 안 됩니다. 실제 브라우저 화면은 Playwright CLI screenshot의 SHA256, 레코드 ID, 관측 플러그인 버전과 source commit을 함께 기록합니다. 출시 후보의 패키지 버전과 브라우저 관측 버전이 다르면 통합 증거에 두 경계를 각각 남기며, 새 브라우저 검증으로 오해하지 않습니다.

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
