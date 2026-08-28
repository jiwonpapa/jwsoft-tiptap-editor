# 보안 설계

## 신뢰 경계

신뢰하지 않는 입력은 회원·관리자 입력, 붙여넣기 HTML, 기존 DB HTML, API 직접 호출, 업로드 파일, 외부 URL입니다. 관리자 입력도 저장 전 동일하게 검증합니다.

## 방어 계층

1. Tiptap schema: 편집 가능한 구조 제한
2. paste transform: 불필요한 legacy markup 제거와 손실 안내
3. server sanitizer: 유일한 저장 승인 경계
4. canonical serializer: 등가 HTML을 한 형식으로 정규화
5. DOMPurify allowlist: 출력 방어심층
6. CSP: 잔존 실행 벡터 억제

## class token

`class` 속성은 허용하되 전체 문자열을 신뢰하지 않습니다. 공백으로 분리한 각 token이 정책의 완전 일치 목록에 있어야 합니다. 하나라도 미등록이면 정책 모드에 따라 해당 token을 제거하고 변경 내역을 반환하거나 저장을 거부합니다.

## URL

- link: HTTPS, 상대경로, 필요한 `mailto`·`tel`
- media: HTTPS 또는 G7 상대경로
- `javascript`, `vbscript`, 기본 `data` 금지
- IDN·제어문자·양방향 문자 정규화 후 검사
- `_blank`는 `rel="noopener noreferrer"` 강제

## 이미지

- extension과 실제 MIME 일치
- 허용 MIME allowlist
- 파일·픽셀·가로세로 상한
- SVG 기본 금지
- 임의 파일명 대신 content hash/안전 식별자
- 사용 권한, quota, 저장소 오류는 fail closed

## 업데이트

- `npm audit`, `composer audit`를 CI와 release gate에서 실행
- sanitizer와 editor 보안 공지는 일반 기능 업데이트보다 우선
- 잠금파일 없는 릴리스 금지
- 패키지 checksum 제공

## 보안 테스트

`harness/fixtures/security-corpus.json`의 각 payload에 대해 editor load, paste, API direct submit, render를 모두 검사합니다. 브라우저에서 실행되지 않는 것만으로 통과하지 않으며 저장 HTML도 기대 정책과 일치해야 합니다.
