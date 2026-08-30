# jwsoft-tiptap-editor

그누보드7의 `sirsoft-ckeditor5`를 코어 수정 없이 대체하기 위한 Tiptap v3 기반 WYSIWYG 편집기 플러그인입니다.

> 현재 상태: **`0.1.0-alpha.18` 공개 개발 릴리스**이며 GitHub 최초 설치·`alpha.16 → alpha.18` 온라인 업데이트·CKEditor 롤백을 전용 G7 7.0.9에서 검증했습니다. 게시판·상품·페이지 실브라우저까지 통과해 stable readiness는 **60/62**이고, staging·production 증거가 남아 있어 운영 설치 대상이 아닙니다.

## 결론

- 플러그인 식별자: `jwsoft-tiptap-editor`
- 대상 G7: `>= 7.0.9`
- 에디터: Tiptap v3 / ProseMirror
- 저장 정본: 서버에서 정제한 HTML
- 스타일: 사전 정의 class token만 허용
- 런타임 CDN: 사용하지 않음
- 제품 라이선스: Proprietary(공개 열람 가능, 사용·복제·배포는 별도 서면 계약 필요)

## GitHub 온라인 설치

G7 관리자 `플러그인 → 플러그인 설치 → GitHub에서 설치`에 아래 URL을 입력합니다.

```text
https://github.com/jiwonpapa/jwsoft-tiptap-editor
```

현재 `alpha`는 개발·staging 검증용입니다. CKEditor가 활성화되어 있으면 관리자 플러그인 목록에서 먼저 비활성화한 다음 JWSoft를 활성화합니다. 활성화 후 설정을 열 수 있으며 선행 확인 스위치는 필요하지 않습니다. 설치·활성화·조회만으로 기존 글의 저장된 본문은 바뀌지 않습니다. 기존 글을 JWSoft에서 수정 후 저장할 때 지원하지 않는 서식이 달라질 수 있으며 해당 편집 화면에서 별도로 안내합니다.

공개 개발 릴리스: [v0.1.0-alpha.18](https://github.com/jiwonpapa/jwsoft-tiptap-editor/releases/tag/v0.1.0-alpha.18)

## 완료 조건

stable 1.0.0은 기존 `sirsoft-ckeditor5`가 제공하는 편집기 교체, 이미지 업로드와 관리, 설정, 권한, 훅, 다국어, 설치·업데이트·롤백을 모두 대체하고 G7 게시판·쇼핑몰·페이지에서 문제가 없다는 자동화 증거가 있어야 합니다.

상세 조건: [CKEditor 대체 동등성](docs/acceptance/sirsoft-ckeditor5-parity.md)

## 빠른 시작 — MVP 구현 단계

```bash
cp .env.example .env
npm ci
composer install
make doctor
make check
make build
```

`make release-check`는 실제 구현과 동등성 증거가 없으면 의도적으로 실패합니다.

## 문서

- [헌법](CONSTITUTION.md)
- [제품 기획](docs/01-product-brief.md)
- [MVP 범위](docs/02-mvp-scope.md)
- [아키텍처](docs/03-architecture.md)
- [보안 정책](docs/04-security.md)
- [설치](docs/06-installation.md)
- [개발 환경](docs/07-development.md)
- [테스트](docs/08-testing.md)
- [배포](docs/09-deployment.md)
- [구현 작업 분해](docs/11-work-breakdown.md)

## 주요 명령

```bash
make doctor            # 로컬 도구와 G7 테스트 호스트 확인
make check             # 문서·manifest·policy·타입·단위 테스트
make build             # IIFE 자산 빌드
make integration-check # 전용 G7 테스트 호스트 계약 검사
make parity-evidence   # 실제 브라우저·수명주기 결과를 통합 증거로 생성
make parity-gate       # CKEditor 완전 대체 증거 검사
make package           # 릴리스 ZIP 생성
make release-candidate-check # alpha 후보 전체 게이트
make release-check     # 전체 P0가 남아 있으면 stable 차단
make deploy-plan ENV=staging
make deploy ENV=staging APPLY=1
```

## 저장소 경계

이 저장소가 제품 소스와 릴리스의 SSoT입니다. 그누보드7 저장소는 통합 테스트 호스트이며, 제품 개발 결과를 G7 코어 수정으로 숨기지 않습니다.
