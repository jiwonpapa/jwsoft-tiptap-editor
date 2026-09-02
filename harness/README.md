# 검증 하네스

이 디렉터리는 구현보다 먼저 고정하는 외부 계약과 회귀 입력입니다.

주 실행기는 Python `jw_harness/`입니다. `make check`, `make audit`, `make browser-check`가 이를 사용합니다. Python 도구는 `requirements-dev.txt`로 고정하고 Ruff/mypy 및 `tests/`의 부정 회귀를 실행합니다. 범용 Node 신규 하네스는 금지하며 기존 이전 목록/대형 코드 예외는 `governance/debt.json`에 만료일과 함께 기록합니다.

- `contracts/g7-surfaces.json`: G7에서 교체·무회귀를 확인할 화면과 API
- `contracts/ckeditor-parity.json`: stable 릴리스를 막는 CKEditor 대체 기준
- `fixtures/security-corpus.json`: 서버 sanitizer 공격 입력
- `fixtures/legacy-html.json`: 기존 CKEditor HTML 보존 입력

`make parity-gate`는 계약별 pass 결과와 artifact 경로가 든 `test-results/parity/evidence.json`이 없으면 실패합니다. 수동 확인만으로는 이 파일을 만들 수 없습니다.

## 작성 도구 로컬 미리보기

`npx vite --host 127.0.0.1` 실행 후 `/harness/ui-preview.html`을 열면 메뉴와 밝은/어두운 테마를 확인할 수 있습니다. 현재 편집기 소스를 사용하며 서버 저장·파일 업로드·운영 인증을 수행하지 않습니다. 자동 검증은 `make browser-check`로 분리된 UI 5개 suite를 모두 실행합니다. 사용자의 실제 브라우저 세션을 점유하지 않습니다.
