# 개발 환경

## 권장 구조

```text
/Users/.../jwsoft-tiptap-editor   # 제품 저장소
/Users/.../g7-editor-harness       # 전용 G7 테스트 checkout
```

평소 사용 중인 G7 작업 저장소에 하네스가 플러그인을 복사하지 않습니다.

## 준비

```bash
cp .env.example .env
# G7_ROOT를 전용 테스트 checkout 절대경로로 수정
npm ci
composer install
make doctor
make check
make build
```

## 단계별 게이트

| 단계        | 명령                     | 의미                     |
| ----------- | ------------------------ | ------------------------ |
| scaffold    | `make check build`       | 문서·정책·도구·빌드 환경 |
| feature     | `make test`              | 단위·계약 테스트         |
| integration | `make integration-check` | 전용 G7 checkout 계약    |
| parity      | `make parity-gate`       | CKEditor 대체 증거       |
| release     | `make release-check`     | 패키지 생성까지 전체     |

## Tiptap 구현 원칙

- G7 extension lifecycle handler가 editor instance를 생성·파기합니다.
- `@tiptap/react` 없이 core를 우선 사용해 React runtime 중복을 피합니다.
- toolbar는 G7 스타일을 따르되 임의 inline style을 생성하지 않습니다.
- custom extension은 token enum만 받고 HTML parser도 같은 enum을 검사합니다.
- 에디터 update 후 G7 local state를 debounce로 동기화합니다.
- await 뒤에는 캡처 상태 대신 G7 최신 상태를 다시 읽습니다.

## 전용 G7 checkout

`G7_ROOT`가 dirty이면 integration 하네스는 기본 실패합니다. 정말 필요한 경우에만 `ALLOW_DIRTY_G7=1`을 로컬 `.env`에 설정하며 CI와 배포에서는 금지합니다.
