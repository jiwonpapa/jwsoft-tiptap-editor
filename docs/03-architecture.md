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

G7 StorageInterface를 사용합니다. 업로드 레코드, 장기 캐시 serve, 참조 스캔, 관리자 단건·일괄 삭제, opt-in 미사용 정리를 `sirsoft-ckeditor5`와 동등한 계약으로 제공합니다. 저장 후 DB 기록 실패 시 물리 파일을 즉시 회수하고, 참조 소스가 불완전하면 실제 자동 삭제를 중단합니다.

공개 훅은 `jwsoft-tiptap-editor.image.*`를 정본으로 사용합니다. 교체 시 기존 게시판·페이지·쇼핑몰 및 이미지 최적화 소비자가 끊기지 않도록 `sirsoft-ckeditor5.image.*` 이름도 호환 별칭으로 순차 발화합니다. 외부 소비자는 중복 처리를 피하기 위해 새 이름과 별칭 중 하나만 구독합니다.

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
