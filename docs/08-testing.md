# 테스트 전략

## 피라미드

### Unit

- token command와 schema
- policy parser와 codegen
- canonical HTML serializer
- class·URL·media validation
- G7 state adapter

### PHP contract

- sanitizer service
- FormRequest
- image upload/serve/cleanup
- repository와 StorageInterface
- permission, hook, settings schema

### Integration

- G7 plugin install/activate/deactivate/update
- extension point 주입
- state submit과 API 저장
- legacy HTML round-trip

### Browser E2E

- 게시판, 상품, 페이지
- 다국어, 모바일, 다크모드
- paste, IME, keyboard
- 이미지와 표
- 전환·롤백

## 증거 파일

`test-results/parity/evidence.json`은 다음을 포함합니다.

- plugin/G7/git version
- artifact SHA256
- 실행 시각·환경
- 동등성 항목 ID와 결과
- 브라우저·viewport
- 실패 시 screenshot/trace 경로

수동 체크만으로 evidence를 만들면 안 됩니다.

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
