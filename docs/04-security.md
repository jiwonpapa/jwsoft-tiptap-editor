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

## 게시판 저장 게이트

- 적용 라우트: 사용자 게시글 `store/update`, 관리자 게시글 `store/update`
- `content_mode=html`인 본문은 FormRequest보다 앞에서 canonical HTML로 교체
- HTML 수정인데 `content_mode`가 없으면 `content_mode_required`로 422
- 정제로 내용이 바뀌는데 편집기 정책 확인값이 없으면 `canonical_confirmation_required`로 422
- 정책 파일 누락·checksum 불일치는 `editor_policy_unavailable`로 503

브라우저의 확인값은 보안 경계를 대신하지 않습니다. 직접 API 호출도 같은 서버 sanitizer를 통과하며, 확인값은 기존 HTML이 조용히 바뀌는 것을 막는 사용자 확인 계약입니다.

## 기존 에디터 전환

- `legacyContentRiskAcknowledged` 기본값은 `false`이며, 관리자가 설정 화면의 경고를 확인하기 전에는 플러그인 활성화를 거부합니다.
- 기존 문서 정제 결과가 달라지면 문서별로 다시 읽기 전용 상태를 유지하고, 사용자가 위험을 확인해야 편집·저장이 가능합니다.
- 기존 CKEditor inline style·전용 class·HTML 구조의 일괄 변환이나 자동 마이그레이션은 수행하지 않습니다.
- CKEditor 재활성화는 이후 편집기를 되돌리는 절차이며, 이미 저장되어 달라진 HTML 원문을 복원하지 않습니다.

## class token

`class` 속성은 허용하되 전체 문자열을 신뢰하지 않습니다. 공백으로 분리한 각 token이 정책의 완전 일치 목록에 있어야 합니다. 하나라도 미등록이면 정책 모드에 따라 해당 token을 제거하고 변경 내역을 반환하거나 저장을 거부합니다.

## URL

- link: HTTPS, 상대경로, 필요한 `mailto`·`tel`
- media: HTTPS 또는 G7 상대경로
- `javascript`, `vbscript`, 기본 `data` 금지
- IDN·제어문자·양방향 문자 정규화 후 검사
- `_blank`는 `rel="noopener noreferrer"` 강제

## 이미지

- caption·정렬·크기 저장은 `figure > img + figcaption?`와 allowlist class token만 허용
- 서버는 image figure의 직접 자식, 이미지 URL, 정렬 token 1개, 크기 token 1개를 다시 검사
- 요청 MIME과 실제 파일 MIME을 각각 검사하고 실제 MIME을 저장 정본으로 사용
- 훅 변환 뒤 MIME·크기·픽셀 수를 서버에서 다시 검사
- 파일·픽셀 상한
- SVG 기본 금지
- 임의 파일명 대신 content hash/안전 식별자
- 사용 권한, quota, 저장소 오류는 fail closed
- DB 기록 실패 시 이미 저장된 물리 파일 회수
- 파일 삭제 실패 시 레코드를 보존해 재시도 가능하게 유지

## 외부 미디어

- 사용자가 붙여넣은 iframe·video·embed·script는 계속 제거합니다.
- 저장 정본에는 allowlist class와 정규 URL을 가진 `figure > a`만 허용합니다.
- 출력 handler는 YouTube·Vimeo·MP4 형식을 완전 일치로 다시 확인하고 고정 속성 player만 생성합니다.
- 외부 player는 기본적으로 클릭 후 로드하며 자동재생은 관리자 opt-in이어도 음소거를 강제합니다.
- 기능을 꺼도 기존 canonical node를 삭제하거나 일괄 변환하지 않습니다.

## MP4 업로드

- `videoUpload` 기본값은 꺼짐이며 비활성 상태에서는 업로드 요청도 서버에서 거부합니다.
- 파일명·브라우저 MIME은 참고값일 뿐이며, 서버가 최대 크기·청크 길이·SHA-256·전체 바이트 수·`ftyp` box·실제 `video/mp4` MIME을 검사합니다.
- 128-bit 임의 세션 토큰과 로그인 사용자 소유권을 함께 검사하며, 완료 전 파일은 공개 URL을 발급하지 않습니다.
- 청크는 순차 조립하고 전체 파일을 PHP 문자열 하나로 읽지 않습니다. 저장소에서 읽는 메모리 상한은 설정된 청크 크기입니다.
- DB 기록 실패 시 완성 파일을 회수하고, 중단 세션은 24시간 뒤 자동 정리합니다.

## 링크 스마트카드

- `smartCards`와 `autoSmartCards` 기본값은 꺼짐이며 서버 endpoint도 마스터 설정으로 차단합니다.
- HTTPS 443만 허용하고 URL 사용자정보·제어문자·비표준 포트를 거부합니다.
- DNS의 모든 A/AAAA 응답이 공개 IP인지 검사하고 선택한 IP를 cURL `CURLOPT_RESOLVE`로 고정합니다. 최대 3회 redirect도 같은 검사를 반복합니다.
- HTML만 최대 512KB까지 읽고 연결 3초·전체 6초 timeout과 분당 10회 요청 제한을 적용합니다.
- 저장 정본은 allowlist class와 text·검증 URL만 가진 링크 카드입니다. SNS script·iframe·임의 embed는 저장하지 않습니다.
- 대표 이미지는 기본 꺼짐이며 opt-in이어도 최종 페이지와 같은 공개 호스트의 HTTPS URL만 허용합니다.

## 업데이트

- `npm audit`, `composer audit`를 CI와 release gate에서 실행
- sanitizer와 editor 보안 공지는 일반 기능 업데이트보다 우선
- 잠금파일 없는 릴리스 금지
- 패키지 checksum 제공

## 보안 테스트

`harness/fixtures/security-corpus.json`의 각 payload에 대해 editor load, paste, API direct submit, render를 모두 검사합니다. 브라우저에서 실행되지 않는 것만으로 통과하지 않으며 저장 HTML도 기대 정책과 일치해야 합니다.

현재 MVP 4차에서는 PHP sanitizer, 브라우저 allowlist, G7 미들웨어 직접 제출과 이미지 훅·실제 MIME·저장 롤백·고아 레코드 정리를 자동 검사합니다. 실제 clipboard paste와 저장 후 브라우저 render 전수 증거는 후속 browser parity gate에 남겨 둡니다.
