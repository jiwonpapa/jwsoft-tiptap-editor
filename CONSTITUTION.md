# jwsoft-tiptap-editor 헌법

이 문서는 제품의 최상위 의사결정 규칙입니다. 편의·일정·기능 요구가 이 문서와 충돌하면 이 문서가 우선합니다. 변경은 ADR, 보안 영향 분석, 버전 변경, 사용자 승인 없이 할 수 없습니다.

## 제1조 — 제품 목적

`jwsoft-tiptap-editor`는 그누보드7에서 `sirsoft-ckeditor5`를 코어 수정 없이 완전히 대체하는 정책 기반 WYSIWYG 편집기 플러그인입니다. 단순 UI 교체가 아니라 편집, 저장, 출력, 이미지, 권한, 업데이트와 롤백을 하나의 검증 가능한 제품 계약으로 제공합니다.

## 제2조 — 코어 무수정

그누보드7 코어와 번들 템플릿·모듈을 직접 수정하지 않습니다. 공식 `html_editor`, `html_content`, 라우트, 훅, Storage, 설정, 권한 및 확장 업데이트 계약만 사용합니다. 부족한 확장 지점이 발견되면 우회 코드를 넣지 않고 G7 개선 이슈와 플러그인 fallback을 분리합니다.

## 제3조 — 서버가 신뢰 경계

브라우저, Tiptap schema, DOMPurify 결과를 신뢰하지 않습니다. 모든 저장 요청은 서버에서 `policy/editor-policy.json`과 동일한 규칙으로 재검증하고 정규화합니다. 검증기 오류나 정책 로드 실패 시 원문 저장이 아니라 실패 응답을 반환합니다.

## 제4조 — 최소권한 HTML

허용 태그, 태그별 속성, URL scheme·host, 이미지 source, class token과 문서 크기는 명시적 allowlist입니다. 다음은 기본적으로 금지합니다.

- `style`, `id`, `on*`, 임의 `data-*`
- 임의 클래스 문자열
- `javascript:`, 기본 미승인 `data:` URL
- iframe, script, svg, form, 외부 실행 콘텐츠

스타일은 사전 정의한 class token으로만 표현하며 편집기, 서버, renderer와 CSS가 같은 정책 버전을 사용합니다.

## 제5조 — 기존 데이터 호환

MVP 저장 정본은 canonical HTML입니다. 기존 게시글·상품·페이지·검색·SEO·API 계약을 유지합니다. legacy HTML을 열 때 제거 또는 변환 손실이 있으면 저장 전에 차이를 표시하고 취소할 수 있어야 합니다. 조용한 데이터 손실은 결함입니다.

## 제6조 — 자체 호스팅과 공급망

런타임 CDN 의존을 금지합니다. JavaScript, CSS, 번역과 폰트는 릴리스 패키지에 포함하거나 G7 자산 계약으로 제공합니다. 의존성은 lockfile로 고정하고 CI에서 advisory와 라이선스를 검사합니다. Tiptap Pro 기능은 별도 상용 결정과 ADR 없이는 도입하지 않습니다.

## 제7조 — CKEditor 완전 대체

stable 릴리스는 `docs/acceptance/sirsoft-ckeditor5-parity.md`의 필수 항목을 모두 증명해야 합니다. 편집 기능뿐 아니라 이미지 업로드·저장·관리·정리, 설정, 권한, 훅, 다국어, read-only, 설치·업데이트·비활성화·롤백까지 포함합니다.

## 제8조 — 안전한 공존과 전환

두 replace 플러그인이 동시에 활성화되어 우선순위 경쟁을 하면 안 됩니다. 설치는 가능하되 활성화 전에 충돌을 탐지하고 명확히 중단합니다. 전환은 CKEditor 비활성화, jwsoft 활성화, smoke, 실패 시 역순 롤백으로 처리합니다.

## 제9조 — 증거 기반 출시

코드 존재는 완료가 아닙니다. unit, contract, integration, browser E2E, XSS corpus, legacy round-trip, package install/update/rollback과 G7 주요 화면 검증 결과가 필요합니다. 통과 증거가 없는 항목은 미완료입니다.

## 제10조 — 실패 폐쇄형 배포

패키지와 배포 하네스는 dry-run이 기본입니다. stable 태그, parity evidence, checksum, 깨끗한 Git 상태, 승인된 대상 환경이 없으면 배포하지 않습니다. 프로덕션 배포는 staging과 동일 artifact checksum을 사용합니다.

## 제11조 — 비밀과 개인정보

비밀번호, 토큰, 개인키, 인증서, 운영 도메인·서버 정보가 저장소에 들어가면 안 됩니다. 테스트 fixture에는 개인정보를 사용하지 않습니다. 업로드 로그와 관리자 기능은 최소 정보만 보관합니다.

## 제12조 — 변경 절차

헌법 변경은 다음을 모두 요구합니다.

1. `docs/adr/` 의 새 ADR
2. 보안·호환성·마이그레이션 영향
3. 관련 테스트와 문서 변경
4. CHANGELOG 기록
5. 형님의 명시적 승인
