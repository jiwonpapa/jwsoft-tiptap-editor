# 셀프 감사 — 감사 수단과 실제 강제력

- 감사일: 2026-09-05
- 대상: v0.1.3, `79d5f8cf2c1a9b1951f101565822d896d31ddd12`
- 판정: 감사 수단은 정의·구현되어 있으나, 증거 연결과 규약 우회 차단은 미완료입니다.
- 범위: 헌법·개발 규약, Python 하네스, 정적 검사, 의존성 감사, 증거 소비자, 출시·배포 경로, GitHub CI·브랜치 보호.
- 제외: 이번 턴의 실제 G7 쓰기·설치·운영 배포, 전체 UI 재실행, 모든 SNS 실서비스 URL 검증, 제품 전체의 수동 보안 감사.

## 정의된 수단과 이번 확인

| 영역       | 정의 및 실행 수단                                                                          | 이번 확인                                                                                    |
| ---------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| 헌법·규약  | `CONSTITUTION.md`, `docs/13-engineering-standards.md`, `harness/governance/debt.json`      | 언어·크기·금지 코딩·증거 규칙 존재. 일부 차단 누락 재현                                      |
| 기본 품질  | `make check`: Ruff, mypy, typed ESLint, tsc, PHPStan, PHP 문법, ShellCheck, 단위·계약 검사 | 성공. Python 회귀 64개, TypeScript 단위 285개 통과                                           |
| 의존성     | `make audit`: npm, Composer, Python 고정 패키지 advisory                                   | 성공. npm 0건, Composer advisory 없음, Python 7개 확인                                       |
| UI·실제 G7 | `make browser-check`, `make g7-browser-check`, `make integration-check`, lifecycle         | 명령·계약·실행 증거 검증기 존재. 이번에는 재실행하지 않음                                    |
| 패키지     | 재현 ZIP, 라이선스, 공급망 검사                                                            | 기존 ZIP에 `node scripts/license-audit.mjs --artifact` 재실행 성공. 재빌드 없음              |
| 출시       | 후보 57 / 사전배포 60 / 운영 전 61 / 최종 62                                               | 보고서 작성 전 깨끗한 HEAD에서 최종 62/62. 아래 발견 사항을 검증하지 못하는 현행 계약의 결과 |
| 원격 강제  | GitHub CI 및 main 보호                                                                     | 필수 `validate`, strict·관리자 보호, 강제 push·삭제 금지 적용. 그러나 현재 main CI 실패      |

`make check` 실행 ID는 `71889216402a4408982bb2ac6e21f0d0`이며 명령 99개의 실행 로그를 기록했습니다. 당시 source fingerprint는 `a8a96ca44e442022cb7c3fdb6be4e965933b5df476a21ae61758e5f3eba5b559`입니다. 단위 커버리지는 statements 71.12%, branches 61.44%, functions 70.01%, lines 73.21%입니다. 이는 전역 단위 커버리지이며 전체 UI/G7 기능의 커버리지 수치가 아닙니다.

증거 판정은 품질 검사 종료 후 순차 실행한 결과를 사용했습니다. 검사 실행 중 읽은 중간 상태는 최종 판정에서 제외했습니다. 본 보고서 추가 전의 clean HEAD에 대한 결과이며, 이후 변경에도 그대로 유효하다는 뜻은 아닙니다.

## 발견 사항

### SA-01 · P1 — 현재 main CI 실패와 감사 오류의 상세 기록 누락

- 근거: [현재 HEAD의 CI 실행](https://github.com/jiwonpapa/jwsoft-tiptap-editor/actions/runs/33825412665), `harness/jw_harness/quality.py:71`, `harness/jw_harness/process.py:15`, `.github/workflows/ci.yml:35`.
- 2026-09-04 01:22 UTC에 `npm audit`가 종료 코드 1을 반환하여 CI가 중단되었습니다. 이후 check/build/browser는 skipped입니다.
- npm 결과는 `capture=True`로 수집하지만 오류 응답을 출력·보관하지 않아 로그에 실패 명령만 남습니다. CI artifact도 해당 실행에서는 저장할 파일이 없어 생성되지 않았습니다.
- 오늘 같은 checkout의 로컬 audit는 통과했습니다. 당시 원인이 네트워크, registry 응답, advisory 중 무엇인지는 현재 남은 로그만으로 확정할 수 없습니다.
- 조치: 실패 stdout/stderr와 구조화된 audit 결과를 Python 실행 기록으로 남기고 CI artifact에 포함해야 합니다. 원인을 구분한 후 현재 HEAD의 CI 성공을 확인해야 합니다. 오류 무시나 무조건 성공 처리는 금지합니다.
- 이전 PR 통과와 merge 후 main CI 통과는 다릅니다. 현재 상태를 CI까지 정상 완료라고 보고하면 부정확합니다.

### SA-02 · P1 — 실제 배포 없이 만든 성공 기록을 소비자가 수용

- 근거: `scripts/deploy-evidence.mjs:29`, `scripts/deploy-evidence.mjs:108`, `scripts/stable-evidence.mjs:302`, `scripts/stable-evidence.mjs:329`.
- 단독 `record`는 환경변수로 받은 버전·SHA·대상·smoke URL만으로 `status: pass`를 씁니다. 배포 트랜잭션 실행 ID, 원격 명령 로그, HTTP 결과의 실행 기록을 요구하지 않습니다.
- 격리된 임시 디렉터리에서 존재하지 않는 테스트 대상과 임의 SHA로 record를 실행했습니다. SSH·HTTP 실행은 0회인데 staging artifact validator와 `verify-production`의 staging 확인이 모두 수용했습니다.
- 이는 **개별 증거 검사 우회** 재현입니다. 전체 출시 gate·승인 토큰을 모두 우회했다거나 실제 운영 배포가 없었다는 주장이 아닙니다. 정상 `deploy.sh`는 Python 트랜잭션 성공 뒤 기록하지만, 소비자가 그 실행 사실을 확인하지 못합니다.
- 조치: 배포 트랜잭션이 실행 기록과 결과를 함께 소유하게 하고, 단독 성공 기록기를 폐기해야 합니다. staging/production 소비자는 실행·파일·활성 상태·HTTP 결과와 SHA 연결을 확인해야 합니다.

### SA-03 · P1 — 의존성 audit 실행 증거가 출시·배포 판정에 없음

- 근거: `harness/jw_harness/quality.py:71`, `harness/contracts/stable-readiness.json:403`, `scripts/supply-chain-evidence.mjs`, `scripts/stable-evidence.mjs:295`.
- `make audit`와 CI의 audit 단계는 실제 실행됩니다. 그러나 `supply-chain.locks-audit` 항목이 소비하는 파일은 라이선스와 패키지 구성 결과뿐입니다. npm/Composer/Python advisory 실행 결과를 요구하지 않습니다.
- 격리 재현에서 `status`, ZIP SHA, CDN 개수, 재현성 확인 필드만 있는 supply-chain JSON을 개별 소비자가 수용했습니다. audit 실행 기록은 없었습니다.
- `release-candidate-check`가 audit 명령을 실행하는 점은 유효한 보호입니다. 다만 독립 출시·배포 gate는 이전 audit의 누락·실패·오래된 결과를 증거로 판별하지 못합니다.
- 조치: lockfile·소스·도구 버전·시각·실행 ID에 결합된 Python audit 증거를 만들고 기존 `supply-chain.locks-audit` 계약에 연결해야 합니다. 출시 기준 62개를 늘릴 문제가 아니라 기존 기준의 증명을 보강할 문제입니다.

### SA-04 · P2 — 줄 끝 린트 해제로 금지 타입 검사 우회

- 근거: `harness/jw_harness/governance.py:76`, `eslint.config.mjs`.
- 실제 ESLint의 `lintText`와 현재 `inspect_source`에 아래 입력을 넣어 비교했습니다. 제품 파일은 수정하지 않았습니다.

```ts
export const value: any = 1; // eslint-disable-line @typescript-eslint/no-explicit-any
```

- 해제 주석이 없으면 ESLint 오류 1개, 주석이 있으면 오류 0개였습니다. governance도 오류 0개를 반환했습니다.
- 주석 탐지 정규식이 줄 시작의 주석만 찾고, ESLint는 inline config를 허용하기 때문입니다.
- 조치: 제품 소스의 inline config를 금지하거나 승인된 예외만 허용하고, 줄 끝·블록 주석·전체 규칙 해제의 부정 회귀를 추가해야 합니다. 일반 설명 문자열까지 무작정 금지하는 방식은 피해야 합니다.

### SA-05 · P2 — 새 범용 Node 하네스 금지가 특정 디렉터리에만 적용

- 근거: `harness/jw_harness/governance.py:67`.
- 동일한 신규 범용 Node 코드가 `scripts/audit-runner.mjs`에서는 거부되지만, 루트 `audit-runner.mjs`에서는 `inspect_source` 오류 0개였습니다. 파일 생성 없이 입력으로 재현했습니다.
- 루트 파일도 크기 검사 대상이지만, Node 하네스 금지 분기는 `scripts/`·`harness/` 접두어에만 적용됩니다.
- 조치: 위치로 범용 하네스 여부를 우회할 수 없도록 추적 소스 전체의 허용 경로/용도를 명시해야 합니다. 언어 전용 빌드·AST·Playwright 도구 예외는 유지합니다.

### SA-06 · P2 — 기본 검사와 패키지 라이선스 검사가 같은 증거를 덮어씀

- 근거: `harness/jw_harness/quality.py:16`, `scripts/license-audit.mjs:91`, `scripts/license-audit.mjs:128`.
- `make check`의 source-only 라이선스 검사가 기존 `test-results/release/license.json`을 `artifactChecked: false`, SHA null로 덮어씁니다.
- 이번 순차 실행에서도 기본 검사 성공 후 release-check는 해당 항목 때문에 61/62로 차단됐습니다. 기존 ZIP에 `--artifact` 검사를 실제 재실행한 뒤에는 62/62였습니다. 증거를 수동 수정하거나 배포하지 않았습니다.
- 출시 소비자의 거부는 정상입니다. 문제는 다른 범위의 감사가 같은 결과 파일을 공유하여 실행 순서에 따라 준비 상태를 바꾸는 점입니다.
- 조치: 소스 라이선스와 패키지 라이선스 증거 경로·스키마를 분리하고, 한 검사가 다른 범위의 증거를 덮어쓰지 않도록 해야 합니다.

### SA-07 · P2 — 에이전트 규칙과 현재 헌법의 SDK 허용 범위 불일치

- 근거: `AGENTS.md:17`, `CONSTITUTION.md:38`, ADR-0018.
- AGENTS는 X·Facebook만 예외로 기록하지만, 현재 헌법은 승인된 Instagram·TikTok까지 포함합니다.
- 조치: 승인된 ADR-0018에 맞춰 AGENTS와 관련 계약 문구를 동기화하고, 일반 CDN 금지와 공식 SDK 예외를 구분해야 합니다. 추가 제공자 허용으로 확대하는 작업이 아닙니다.

## 이미 명시돼 있는 미완료 범위

새 결함과 구분해야 하는 기존 기술 부채입니다. `make check` 통과가 이 부채를 해소하지 않습니다.

- legacy 범용 Node 하네스 34개가 이전 목록에 남아 있습니다. Python 진입점이 있어도 Python 이전 완료는 아닙니다.
- 큰 파일 예외 4개: toolbar 1,315줄, initEditor 459줄, stable-evidence-test 493줄, EditorSanitizer 561줄입니다.
- 큰 함수 예외는 17개 파일의 28개 symbol입니다. 예외 개수이며 현재 초과 함수 전수 측정값으로 표현하지 않습니다.
- 등록된 만료일은 2026-10-17입니다. 만료·상한 규칙은 실제 검사되지만 리팩터링 완료를 의미하지 않습니다.
- PHPStan level 5는 독립 정책·정제 영역만 대상으로 합니다. G7 의존 controller/service 전체의 정적 분석은 아닙니다.
- 공식 SNS live 표시 테스트는 계약상 optional이며 `JWSOFT_LIVE_SOCIAL`을 켜야 실행됩니다. 필수 결정적 SDK mock 회귀와 실제 모든 외부 게시물의 표시 성공은 구분해야 합니다.
- main 필수 승인 리뷰 수는 0입니다. PR·CI 강제는 확인했으나 독립된 2인 코드 감사가 강제되는 구조는 아닙니다.

## 결론과 처리 순서

감사 정의가 없는 프로젝트는 아닙니다. 그러나 **감사 도구가 통과했다는 이유만으로 규약 준수와 출시 증거가 완전하다고 말할 수 없는 상태**입니다. “남은 것은 외부 사용자 피드백뿐”이라는 완료 표현은 현재 코드와 맞지 않습니다.

1. SA-01~03: CI 오류 가시성과 audit/배포 실행 증거 연결을 먼저 닫습니다.
2. SA-04~07: 규약 우회·증거 덮어쓰기·문서 불일치를 기존 회귀와 함께 고칩니다.
3. 기존 대형 코드·Node 이전 부채는 별도 목록으로 유지하고 실제 이전만 완료로 기록합니다.

이번에는 감사와 보고서 작성만 했습니다. 제품·하네스 수정, commit, push, 운영 배포는 수행하지 않았습니다. 감사용 가짜 기록은 별도 임시 fixture에만 생성했으며 실제 배포 기록과 출시 입력에는 넣지 않았습니다. 현행 62/62 결과를 새로운 감사 발견 사항의 해결이나 운영 기능 재검증으로 승격하지 않습니다.
