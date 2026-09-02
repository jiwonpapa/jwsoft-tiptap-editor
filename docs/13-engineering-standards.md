# 개발 규약과 자동 차단 범위

최상위 규칙은 [헌법](../CONSTITUTION.md), 변경 근거는 [ADR-0016](adr/0016-python-harness-governance.md)입니다.

## 언어와 재사용

| 영역           | 언어 / 책임                                               |
| -------------- | --------------------------------------------------------- |
| 제품 브라우저  | TypeScript strict; 편집/출력 공통 정책과 플레이어 재사용  |
| 서버           | PHP; canonical 검증, G7 Contract/Helper                   |
| 주 하네스      | Python 3.12+; 검사 조합, 안전한 파일 접근, 증거/출시 판단 |
| 간단한 배포    | Shell; 명령 연결, 명시적 적용 확인                        |
| 언어 전용 도구 | Playwright TypeScript, JS AST/빌드/생성, Laravel PHP 검사 |

HTTP 인증은 `resources/js/g7/authorization.ts`, HTML 정책은 `policy/editor-policy.json`, 편집/출력 플레이어는 공통 media/social 모듈을 사용합니다. 같은 판단을 복사하지 않습니다. 생성 파일을 수동 수정하지 않습니다.

## 자동 검사

- Python: Ruff(복잡도 10), mypy strict, 파일 300줄/함수 80줄, shell 실행 차단.
- TypeScript: typed ESLint의 explicit-any/floating-promises/await-thenable, strict tsc, 제품 함수 80줄. 정책 계층→UI 및 editor→handlers/admin 역방향 import 차단.
- 일반 소스 450줄/테스트 650줄; 기존 초과는 `harness/governance/debt.json` 상한·만료 검사. 함수 예외는 AST의 기존 함수 식별자별로 한 번만 적용하고 신규 함수에는 적용하지 않습니다.
- PHP: `php -l` 및 PHPStan level 5의 독립 정책/정제 영역. 호스트 의존 영역은 현재 별도 통합 검사이며 전수 PHPStan이라고 보고하지 않습니다.
- Shell: bash 문법 + ShellCheck warning 이상 오류.
- Vitest 전역 하한: statements 70%, branches 59%, functions 69%, lines 72%. 새 코드의 테스트를 생략해도 좋다는 뜻이 아니며 하한 하향은 승인 대상입니다.
- 실제 typed lint에 잘못된 코드를 입력하는 회귀, 증거 누락/변조/후보 승격/위험 정리 등 부정 테스트를 필수 유지합니다.

임의 타입 우회, 실패를 성공으로 변환하는 catch, `.only`, 비밀·환경 하드코딩, 범용 `.mjs` 신규 추가, `.build` 일회성 코드의 정식 검증 사용을 금지합니다. 문구 기반 기능 식별·복사된 정책·불필요한 adapter 결합은 리뷰 항목이기도 합니다. 자동 검사로 의미적 중복을 전부 탐지한다고 주장하지 않습니다.

## 실행

```bash
make bootstrap          # venv + 고정 Python 도구 + npm/composer
make check              # Python이 전체 오프라인 검사 조합
make audit              # npm/composer/Python 취약점; 네트워크/오류 시 실패
make browser-check      # UI 5개 + 결정적 SNS suite, 독립 headless
make clean              # 캐시 정리 계획만
make clean-apply        # 허용 캐시만 삭제; 패키지/증거/G7 보존
```

CI는 check/build/audit/browser를 필수로 실행합니다. 분리한 UI suite를 모두 실행할 때 예전 `editor-ui.spec.ts` 하나만 지정하지 않습니다. `test-results/harness/browser-ui.json`은 실행 범위·성공/건너뜀 수·소스/번들/결과 해시를 보관합니다. 실패 시작 시 이전 성공 기록을 재사용하지 않습니다.

check/integration/browser의 성공 기록은 Python 실행기가 소유합니다. 명령 종료 코드·로그 해시·실행 중 소스 불변·실행 이후 생성된 결과를 묶으며, 단독 check/integration pass 기록기는 폐기했습니다. 출시 소비자도 실행 영수증을 확인합니다. 브라우저는 `harness/contracts/browser-execution.json`의 이름·프로젝트별 필수 케이스와 허용 skip을 대조하고 24시간 내 실행만 인정합니다. 실제 G7 화면 관측의 추적 실행기가 없는 항목은 옛 JSON으로 통과시키지 않고 계속 미검증으로 남깁니다.

배포 Shell은 설정·계획과 Python 트랜잭션 연결만 담당합니다. Python 직접 실행도 `--apply`·production 확인값·동일 staging SHA·배포 gate를 다시 요구합니다. update 전 `.build/jwsoft-tiptap-editor-이전버전.zip` 전체 파일 해시가 현재 설치와 일치해야 합니다. 적용·활성 상태·파일·HTTP 검사 중 실패하면 그 ZIP과 이전 활성 상태로 복구하고 HTTP를 재검사합니다. 복구 실패는 별도 critical 오류이고 배포 pass를 기록하지 않습니다. DB 덤프는 하지 않습니다.

## 관측과 출시

GitHub `main` 보호의 선언은 `harness/governance/main-protection.json`입니다. PR 경로, GitHub Actions의 `validate` 필수 통과, 최신 기준 브랜치, 대화 해결, 관리자 포함 보호, 강제 푸시/삭제 금지를 요구합니다. 필수 승인 리뷰 수는 현재 0이며 이를 2인 리뷰 강제로 표현하지 않습니다. 보호 설정은 서버에 별도로 적용·재조회해야 하며 파일 존재만으로 적용 완료라고 하지 않습니다.

```bash
.venv/bin/python -m harness.jw_harness record-observation path/to/observations.json
.venv/bin/python -m harness.jw_harness publish-stable --tag vX.Y.Z
```

첫 명령은 `unverified` 관측만 기록합니다. 두 번째는 현재 최종 62개 조건을 실제 재검사하는 게시 계획이며, 태그/ZIP의 버전을 바꾸지 않습니다. 실제 게시는 동일 명령에 `--apply --approval publish-verified-jw-editor-stable`이 필요합니다. 먼저 검증한 commit에 로컬·원격 태그가 일치해야 합니다. 자동 게시 작업은 버전 문자열과 관계없이 항상 prerelease 후보로만 게시합니다. Python은 후보의 ZIP을 다시 내려받아 배포한 ZIP과 대조한 뒤 기존 릴리스의 prerelease 표시만 해제합니다. CLI 구현의 존재는 새 버전의 검증·배포·게시 완료가 아닙니다.

## 아직 남는 작업

기존 Node 검증기 실제 이전, toolbar/writingTools 등 대형 책임 분리, G7 실제 화면/저장 관측의 추적되는 실행기 이전, 호스트 의존 PHP 정적 분석은 단계적으로 남습니다. 만료되는 기술 부채를 정상 통과 수치로 감추지 않습니다.

## 도구 근거

[Ruff 복잡도 규칙](https://docs.astral.sh/ruff/rules/complex-structure/), [typescript-eslint 타입 기반 검사](https://typescript-eslint.io/blog/project-service/), [PHPStan 심볼 발견과 분석 범위](https://phpstan.org/user-guide/discovering-symbols)를 따릅니다. 검사 도구 설치와 해당 규칙의 실제 활성화는 구분합니다.
