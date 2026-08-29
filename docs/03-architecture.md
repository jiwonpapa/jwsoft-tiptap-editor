# 아키텍처

## 시스템 경계

```text
G7 layout extension point
  -> jwsoft editor lifecycle adapter
  -> Tiptap/ProseMirror document schema
  -> canonical HTML serializer
  -> G7 API request
  -> server policy sanitizer
  -> existing G7 HTML column
  -> html_content renderer
  -> DOMPurify allowlist + token CSS
```

## 레이어

### 1. G7 adapter

`html_editor`와 `html_content`의 props, lifecycle, state sync를 담당합니다. G7의 `G7Core.dispatch`, state 계약과 확장 자산 로더만 사용합니다.

### 2. Editor domain

Tiptap core와 custom node/mark를 소유합니다. 일반 TextStyle을 통한 inline style 출력을 사용하지 않습니다. 모든 스타일 명령은 token enum을 받습니다.

### 3. Policy

`policy/editor-policy.json`이 허용 HTML의 유일한 데이터 원본입니다. 빌드 과정이 다음 파생물을 생성하도록 구현합니다.

- TypeScript token과 schema 옵션
- PHP sanitizer 설정
- content CSS safelist
- 보안 테스트 fixture

파생물 수동 편집은 금지합니다.

### 4. Server

플러그인 서비스가 입력 길이 검사, HTML parse, element/attribute/class/URL/media 정제, canonical serialize를 수행합니다. controller가 직접 sanitizer나 model을 호출하지 않습니다.

G7 7.0.9 게시판의 사용자·관리자 `store/update` 라우트는 플러그인 self-gate 미들웨어가 감쌉니다. HTML 수정 요청은 `content_mode=html`을 명시해야 하며, 정책 파일과 codegen checksum이 다르면 저장하지 않습니다. 정제로 HTML이 바뀌는 요청은 현재 정책 hash에 대한 브라우저 확인값이 있어야 통과합니다.

### 5. Image subsystem

툴바 선택, 편집기 드롭, 클립보드 파일 입력은 모두 동일한 인증·MIME·크기 검증 업로드 API를 사용합니다. `dragDropImageUpload`와 `pasteImageUpload`는 입력 경로만 제어하며 서버 검증을 우회하지 않습니다.

새 이미지 배치의 저장 정본은 `figure.jw-image > img + figcaption?`입니다. 정렬과 25·50·75·100% 크기는 정책 class token으로만 표현하고 출력 CSS가 `max-width: 100%`를 강제합니다. 기존 단독 `img`는 조용히 변환하지 않고 그대로 왕복하며, 사용자가 이미지 편집을 적용할 때만 새 figure 구조로 전환합니다.

G7 StorageInterface를 사용합니다. 업로드 레코드, 장기 캐시 serve, 참조 스캔, 관리자 단건·일괄 삭제, opt-in 미사용 정리를 `sirsoft-ckeditor5`와 동등한 계약으로 제공합니다. 저장 후 DB 기록 실패 시 물리 파일을 즉시 회수하고, 참조 소스가 불완전하면 실제 자동 삭제를 중단합니다.

공개 훅은 `jwsoft-tiptap-editor.image.*`를 정본으로 사용합니다. 교체 시 기존 게시판·페이지·쇼핑몰 및 이미지 최적화 소비자가 끊기지 않도록 `sirsoft-ckeditor5.image.*` 이름도 호환 별칭으로 순차 발화합니다. 외부 소비자는 중복 처리를 피하기 위해 새 이름과 별칭 중 하나만 구독합니다.

### 6. Media embed subsystem

YouTube·Vimeo·MP4는 `figure > a` 형태의 canonical media node로 저장합니다. iframe·video·provider script는 저장하지 않으며, 출력 handler가 URL과 provider를 다시 검사한 뒤 자체 번들 코드로 반응형 player DOM을 만듭니다. 기본 동작은 클릭 후 로드이고 자동재생은 꺼져 있습니다. 상세 결정은 [ADR 0007](adr/0007-safe-media-embeds.md)을 따릅니다.

### 7. MP4 chunk upload subsystem

브라우저는 MP4를 서버가 지정한 1~10MB 청크로 순차 업로드합니다. 각 청크는 SHA-256으로 검증하며, 동일 청크 재전송은 멱등 처리합니다. 세션 토큰과 수신 청크 목록으로 같은 브라우저 탭의 재시도를 이어가고, 서버는 완료 시 청크 순서·해시·전체 크기·MP4 `ftyp` 구조와 실제 MIME을 다시 검사합니다.

임시 청크는 G7 StorageInterface의 `media-temp`, 완성 파일은 공개 자산 디스크의 `media` 범주에 저장합니다. DB 기록 실패 시 완성 파일을 회수하고, 24시간 지난 중단 세션은 매시간 정리합니다. 상세 결정은 [ADR 0008](adr/0008-mp4-chunk-uploads.md)을 따릅니다.

### 8. Smart card subsystem

Instagram·X·TikTok·Facebook·Threads·일반 HTTPS URL은 서버가 제한적으로 HTML metadata를 읽어 `figure > a > strong/p` 카드로 삽입합니다. 저장 HTML에는 provider script·iframe·oEmbed 응답을 넣지 않습니다. SNS가 metadata 요청을 차단하면 검증된 원래 URL과 provider 이름만 가진 안전한 카드로 폴백합니다.

서버 fetch는 공개 DNS 주소를 검사해 cURL 연결 IP를 고정하고, 리다이렉트마다 다시 검증합니다. HTTPS 443만 허용하며 6초 timeout, 3회 redirect, 512KB HTML 상한과 분당 10회 throttle을 적용합니다. 상세 결정은 [ADR 0009](adr/0009-ssrf-safe-smart-cards.md)을 따릅니다.

## 저장 형식

- DB: 기존 HTML 문자열 또는 다국어 HTML map
- 편집 중: ProseMirror JSON
- 제출: canonical HTML
- 선택적 shadow JSON: 별도 ADR과 migration 없이는 금지

## 빌드 산출물

- `dist/js/plugin.iife.js`
- `dist/assets/*`
- extension/layout/lang/routes
- PHP `vendor/`
- `SHA256SUMS`
- ZIP 내부 최상위에 `plugin.json`

## 의존성 원칙

- Tiptap OSS 패키지는 정확한 버전으로 고정
- `@tiptap/react`는 MVP 기본 의존성이 아님
- G7 lifecycle div 안에서 Tiptap core를 구동해 두 번째 React runtime을 싣지 않음
- Symfony HTML Sanitizer는 플러그인 독립 vendor bundle로 패키징
