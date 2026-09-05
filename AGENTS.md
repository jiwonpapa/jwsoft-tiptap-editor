# jwsoft-tiptap-editor Agent Guide

항상 존댓말을 사용하고 사용자를 `형님`이라고 부릅니다. 결과는 결론과 검증 결과부터 간결하게 보고합니다.

## 작업 전 의무

1. 루트의 `CONSTITUTION.md`를 완전히 읽습니다.
2. `docs/acceptance/sirsoft-ckeditor5-parity.md`에서 현재 단계의 완료 조건을 확인합니다.
3. 그누보드7 연동 작업은 `G7_ROOT`가 전용 테스트 체크아웃인지 확인합니다. 사용자의 일반 작업 저장소를 하네스가 자동 수정하면 안 됩니다.
4. 구현·테스트·패키지·배포 결과를 구분해서 보고합니다. 테스트 통과를 운영 배포로 표현하지 않습니다.

## 절대 규칙

- 그누보드7 코어 수정 금지.
- 임의 HTML `style`, 임의 `class`, 임의 `data-*`, 이벤트 속성 저장 금지.
- 클라이언트 검증만으로 저장을 허용하지 않습니다.
- 외부 CDN 런타임 의존 금지. 단, 사용자 승인 ADR-0014·ADR-0018의 화이트리스트 X·Facebook·Instagram·TikTok 공식 게시물 SDK만 예외이며 일반 라이브러리 CDN/임의 실행 HTML은 금지.
- 비밀값, 서버 주소, 인증서, 배포 환경 파일 커밋 금지.
- ADR-0012에 따라 staging 전 동등성 60개, production 전 staging 포함 61개, 최종 stable 승인 전 62개를 통과해야 합니다. 후보 공개는 별도 57개 gate이며 stable 승인으로 표현하지 않습니다.
- 운영 배포는 명시적 `--apply`와 프로덕션 확인 토큰 없이는 실행되지 않아야 합니다.

## 구현 규칙

- 주 하네스는 Python 3.12+, 간단한 배포 명령 연결은 Shell입니다. 제품은 TypeScript/PHP를 유지합니다. ADR-0016과 `docs/13-engineering-standards.md`를 따릅니다.
- 새 범용 Node 하네스·`.build` 일회성 검증·수동 입력의 pass 승격·검사 우회·부채 상한/만료 임의 연장을 금지합니다.
- Python은 파일 300줄/함수 80줄/복잡도 10. 기존 초과 코드는 명시된 만료 부채이며 정상 완료로 표현하지 않습니다.

- 플러그인 식별자: `jwsoft-tiptap-editor`
- 네임스페이스: `Plugins\\Jwsoft\\TiptapEditor`
- 저장 정본: 서버에서 정제한 canonical HTML
- 편집 내부 상태: Tiptap/ProseMirror JSON 허용, DB 정본 전환은 별도 ADR 없이는 금지
- 보안 정책 SSoT: `policy/editor-policy.json`
- Tiptap 기본 `TextStyleKit`으로 inline style을 출력하지 않습니다. class token 전용 extension을 사용합니다.
- G7 공개 저장소/캐시/API는 G7의 Contract와 Helper를 통합니다.
- 새로운 공개 훅·라우트·설정·권한은 문서·테스트·CHANGELOG를 함께 갱신합니다.

## 완료 판단

- 환경 단계: `make check`와 `make build` 통과.
- 인프라 단계: `make audit`와 `make browser-check`; 타입/증거/출시/정리의 금지 사례 회귀. headless 격리 UI와 실제 G7/운영 검증을 구분합니다.
- 구현 단계: `make integration-check` 통과.
- 릴리스 단계: `make release-check` 통과 및 parity evidence 생성.
- 배포 단계: staging smoke 통과 후에만 production 적용 가능.
