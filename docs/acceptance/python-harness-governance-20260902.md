# Python 하네스·개발 규약 개선 검증

- 날짜: 2026-09-02
- 구현 커밋: `368f341`
- 작업 브랜치: `codex/python-harness-governance`
- 범위: 헌법/개발 규약, 로컬·CI 검사, 증거·출시 통제, 코드 재사용과 테스트 분리
- 운영 배포·새 릴리스 게시·G7 코어/DB 변경: 수행하지 않음

## 적용 결과

1. 헌법 v2/ADR-0016/AGENTS에 제품 TS·PHP, 주 하네스 Python, 단순 배포 Shell 경계를 고정했습니다.
2. Python 실행기는 검사 조합·소스 fingerprint·안전한 파일/캐시 처리·전용 G7 표식·수동 관측 분리·실행 결과·정식 승격 판단을 담당합니다. Python 제품 모듈은 최대 95줄이며 Ruff/mypy와 크기·복잡도 제한을 적용했습니다.
3. typed ESLint, 제한된 독립 PHP 영역의 PHPStan level 5, ShellCheck, 전역 커버리지 하한, 고정 Python 의존성 및 npm/composer/PyPI advisory 검사를 추가했습니다. 전수 PHPStan이나 모든 비밀 유형 탐지로 과장하지 않습니다.
4. 기존 UI suite 1,700줄을 공통 fixture 178줄과 기능별 suite 5개(최대 421줄)로 분리했습니다. 21개 테스트 이름을 보존하여 데스크톱/모바일 42개 조합을 실행합니다.
5. 업로드/미리보기의 인증 헤더 중복을 G7 공통 어댑터로 모으고, drop 업로드 책임을 별도 모듈로 분리했습니다. 미처리 Promise 및 테스트 any를 정적 검사의 우회 없이 수정했습니다.
6. 수동 관측을 pass로 만들던 기록기 3개를 폐기했습니다. 새 관측 명령은 unverified만 기록합니다. `.build` 기존 자료를 삭제하거나 새 성공 증거로 재포장하지 않았습니다.
7. 자동 릴리스는 태그 이름과 관계없이 prerelease 후보만 게시합니다. 정식 승격은 현재 final 62개 재검사, 동일 배포 ZIP, 원격 후보 ZIP 재다운로드 checksum, 명시 적용 확인을 요구합니다. 재빌드/임의 신규 정식 게시를 하지 않습니다.
8. `make clean`은 계획만 출력하고 적용 명령도 캐시 allowlist만 처리합니다. 테스트에서 증거/패키지/G7 디렉터리 보존 및 symlink 탈출 거부를 검증했습니다.

## 실제 검사 결과

| 검사                                                       | 결과                                                                       |
| ---------------------------------------------------------- | -------------------------------------------------------------------------- |
| `make check`                                               | 통과                                                                       |
| Python 규약·안전 경계 회귀                                 | 30개 통과                                                                  |
| Vitest                                                     | 240개 통과                                                                 |
| Ruff / mypy / typed ESLint / strict tsc                    | 통과                                                                       |
| PHPStan 적용 범위 / PHP 문법·canonical corpus / ShellCheck | 통과                                                                       |
| `make browser-check` 및 내부 Vite build                    | 31개 통과, 기기별 조건에 따른 11개 skip, 실패/재시도 flaky 0               |
| `make audit`                                               | npm/composer/Python 고정 패키지 7개 advisory 검사 통과                     |
| 정식 게시 기본 계획 명령                                   | 예상대로 차단: 현재 20/62, 나머지 42개는 최신 통합/패키지/배포 증거 미확인 |
| `git diff --check`                                         | 통과                                                                       |

Vitest 측정값은 lines 72.66%, statements 70.51%, branches 59.88%, functions 69.23%입니다. 커버리지는 기능 완성률이 아닙니다.

브라우저 증거는 `test-results/harness/browser-ui.json`과 해당 실행의 Playwright JSON에 남았습니다. 체크/브라우저의 소스 fingerprint를 대조했습니다. 격리 UI 검증이며 G7 로그인·실제 저장·외부 SNS SDK 실통신이나 운영 검증이 아닙니다. 정식 게시 차단은 결함을 완료로 덮지 않는 통제 검증이지, 운영 장애 판정이 아닙니다.

## GitHub 적용과 로컬 코드의 구분

`main` 브랜치 보호는 실제 API 적용 후 다시 조회했습니다. PR 필수, GitHub Actions(app 15368)의 `validate` 필수, 최신 기준 브랜치 검사, 관리자 적용, 대화 해결, 강제 푸시·삭제 금지가 활성화되었습니다. 필수 승인 리뷰 수는 0이므로 2인 리뷰가 강제된다는 뜻은 아닙니다.

변경 소스·새 CI workflow는 이 작업 브랜치에 로컬 커밋했습니다. 원격 push/PR 병합/배포는 하지 않았으므로 새 workflow의 GitHub 실행 완료로 표현하지 않습니다. 작업 시작 시 이미 존재한 로컬 선행 커밋 7개를 이 작업 승인만으로 함께 공개하지 않았습니다.

## 남은 기술 부채와 검증

- 기존 Node 하네스의 실제 이전, toolbar/writingTools 등의 대형 책임 분리는 만료일·담당·현 상한이 있는 부채로 유지합니다. Python 진입점 도입을 전체 JS 이전 완료로 보고하지 않습니다.
- PHPStan은 독립 policy/sanitizer/content/social/value/exception 영역부터 적용했습니다. G7 의존 서비스·컨트롤러의 전체 정적 분석은 남습니다.
- 기존 G7 화면 관측을 추적되는 실제 저장/재조회 실행기로 옮기는 작업과 새 버전의 전용 G7 통합·패키지·배포 증거가 남습니다. 수동 관측을 성공 JSON으로 대신 생성하지 않습니다.
- 의미적 중복, 문구 의존 아이콘, 모든 형태의 환경 하드코딩을 자동 검사만으로 완전히 막을 수 있다고 주장하지 않습니다. 규약·리뷰·추가 회귀를 함께 적용해야 합니다.
