# 헌법 v2 기준 전체 코드 감사

## 결론

**판정: 부적합. 이번 감사로 안정판 승인이나 배포를 권고하지 않습니다.**

기본 검사 통과와 코드 전체의 규약 준수는 다릅니다. 우선 수정 P1 5건, P2 7건을 확인했습니다. 사용자 승인 없는 본문 상태 변경, 서버 설정 집행 누락, 출시 증거의 잘못된 통과, 전용 호스트 보호 누락, 배포 실패 후 복구 공백이 핵심입니다.

이번 작업은 감사입니다. 제품·하네스 수정, 커밋, push, 원격 설정 변경, G7 변경, 배포는 하지 않았습니다. 새 추적 대상은 이 보고서뿐입니다. 임시 진단 결과를 정식 출시 증거로 등록하지 않았습니다.

- 감사일: 2026-09-02
- 기준: `CONSTITUTION.md` v2, 개발 규약, ADR-0016, CKEditor 동등성 체크리스트
- 감사 대상 커밋: `82b9cb09154bcfcedade7f9212352d9571657db5`
- 작업 브랜치: `codex/python-harness-governance`
- 감사 시작 시 Git 상태: clean
- 체크 실행 당시 source fingerprint: `41dd6a4fd42de8579d88279cdae844d57a36e238ff79ee2b23be6339b9170a50`

## 범위와 증거 수준

추적 파일 351개를 목록화하고 제품 코드, 정책, G7 어댑터, 업로드/정리, 미디어/SNS, 저장/수명주기, Python/Node 하네스, Shell 배포, CI/릴리스 계약을 정적 검사와 경계 중심 코드 검토로 감사했습니다. 모든 줄을 사람이 수동 검토했다는 뜻은 아닙니다.

자동 생성 코드와 번들을 제외한 자체 실행 코드·테스트·설정 코드의 집계는 다음과 같습니다.

| 언어       | 파일 |  줄 수 |
| ---------- | ---: | -----: |
| TypeScript |   96 | 13,676 |
| PHP        |   71 |  6,230 |
| Node MJS   |   36 |  4,064 |
| Python     |   21 |  1,070 |
| Shell      |   10 |    684 |
| 합계       |  234 | 25,724 |

이 밖의 JSON 정책·라우트·설정·레이아웃, workflow와 문서는 계약 검사 및 관련 경로 검토에 포함했습니다. 생성물은 생성기·동기화 검사 대상으로 구분했습니다.

- **R — 격리 재현:** 실제 저장소 함수/검사기를 호출해 문제를 재현했습니다. UI는 현재 TS 소스를 메모리 번들로 만든 JSDOM 환경이며, G7 상태·통신만 대체했습니다.
- **S — 정적 확정:** 호출 경로와 조건문으로 누락을 확인했습니다. 해당 운영 동작을 실제 서버에서 실행한 것은 아닙니다.
- **미검증:** 로그인한 G7의 HTTP/DB 저장, 실기기, 외부 제공자 실통신, 패키지 설치/배포는 이번 감사에서 재실행하지 않았습니다. 사용자 브라우저도 사용하지 않았습니다.
- 제3자 의존성은 advisory/lockfile 검사 범위입니다. 의존성 전체 소스 감사나 모든 비밀 유형의 탐지를 완료했다는 뜻은 아닙니다.

## 발견 사항 요약

| ID     | 우선순위 | 발견 사항                                                            | 증거  |
| ------ | -------- | -------------------------------------------------------------------- | ----- |
| AUD-01 | P1       | 언어 탭 전환만으로 미승인 legacy 본문을 정제하고 승인 상태를 설정함  | R     |
| AUD-02 | P1       | 이미지 업로드 OFF 설정을 서버 업로드 요청이 집행하지 않음            | R + S |
| AUD-03 | P1       | 실행 결과 없는 브라우저 증거와 실행을 확인하지 않는 결과 기록기      | R + S |
| AUD-04 | P1       | 수명주기 쓰기 하네스가 새 전용 G7 호스트 검증을 거치지 않음          | S     |
| AUD-05 | P1       | 배포 후 HTTP smoke 실패가 롤백 범위 밖에 있음                        | S     |
| AUD-06 | P2       | 이미지 드롭 업로드 중 편집하면 삽입 위치가 틀어짐                    | R     |
| AUD-07 | P2       | 이미 렌더링한 미디어에 변경된 로드/자동재생 설정을 적용하지 않음     | R     |
| AUD-08 | P2       | TypeScript Promise·의존 경계·큰 함수 차단 규칙에 우회 경로가 있음    | R     |
| AUD-09 | P2       | 새 JS 하네스 금지와 코드 규약 스캔에 경로/확장자 공백이 있음         | R + S |
| AUD-10 | P2       | 미사용 이미지 정리가 오래된 참조 이미지에 막혀 뒤의 후보를 보지 못함 | S     |
| AUD-11 | P2       | 이미지 정리 실패가 발생해도 명령이 성공 코드로 종료함                | S     |
| AUD-12 | P2       | 기존 SNS 결정적 회귀 테스트가 새 필수 CI 브라우저 실행에서 빠짐      | S     |

P1은 데이터 보존·설정 집행·검증 신뢰성·안전한 실행에 영향을 주어 우선 차단해야 하는 문제입니다. P2도 수정 대상이며, 자동 검사 통과만으로 면제하지 않습니다. 아래 개선 방향은 권고이지 구현 결과가 아닙니다.

## 상세 발견 사항

### AUD-01 — 미승인 legacy 본문의 조용한 변경

- 위치: [initEditor.ts:384](../../resources/js/handlers/initEditor.ts#L384), [initEditor.ts:270](../../resources/js/handlers/initEditor.ts#L270), [CanonicalizeEditorHtml.php:50](../../src/Http/Middleware/CanonicalizeEditorHtml.php#L50)
- 재현: 한국어 `<p style="color:red">기존 한글 본문</p>`, 영어 `<p>English</p>`를 다국어 편집기에 전달했습니다. 한국어는 손실 경고로 편집 불가·승인값 없음 상태였습니다. **계속 편집/승인 버튼을 누르지 않고 영어 탭만 클릭**했습니다.
- 결과: 한국어 저장 상태가 `<p>기존 한글 본문</p>`로 바뀌고 공통 `jwsoft_editor_policy_ack`에 정책 해시가 설정됐습니다.
- 원인: 탭 이동 시 이전 편집기의 승인 여부와 무관하게 `getHTML → sanitize → syncEditorValue`를 실행합니다. 새 언어에 손실이 없으면 폼 공통 승인값도 true로 바꿉니다.
- 영향: 이후 폼 저장에 미승인 서식 손실이 포함될 수 있습니다. 서버는 이미 정제된 제출 HTML과 공통 승인값만 보므로 원래 글과의 손실을 이 경로에서 복구하지 못합니다. 실제 DB 저장은 이번에 실행하지 않았습니다.
- 개선: 언어·필드별 원문/승인 상태를 보존하고, 미승인·읽기 전용 편집기는 탐색만으로 저장 상태를 갱신하지 않아야 합니다. 여러 편집기 간 승인값 공유도 함께 다뤄야 합니다.
- 통과 조건: 미승인 언어 전환/취소/read-only/다중 필드에서 원문 불변; 명시 승인 후에만 변경; 실제 저장·재조회로 확인.
- 관련 헌법: 제5조, 제7조, 제14조.

### AUD-02 — 이미지 업로드 OFF의 서버 집행 누락

- 위치: [ImageUploadRequest.php:9](../../src/Http/Requests/ImageUploadRequest.php#L9), [ImageUploadController.php:24](../../src/Http/Controllers/ImageUploadController.php#L24)
- 재현: 설정 조회를 false로 반환하는 최소 PHP 환경에서 실제 Request의 `authorize()`를 호출했습니다. 이미지 요청은 true, 동영상 시작 요청은 false였습니다.
- 원인: 이미지 Request는 항상 true를 반환합니다. 컨트롤러→업로드 서비스에도 `imageUpload` OFF 검사가 없습니다. UI에서 업로드를 숨기는 것은 서버 거부가 아닙니다.
- 영향: G7의 기존 인증 등 다른 조건을 충족하는 호출자는 이미지를 비활성화한 뒤에도 업로드 API를 직접 사용할 수 있습니다. **비로그인 업로드가 가능하다고 판정한 것은 아닙니다.** 상속된 G7 인증 경계는 별도 실제 HTTP 확인이 필요합니다.
- 개선: 이미지 업로드 기능 스위치를 서버 요청/정책 경계에서 확인하고, UI와 동일한 기본값을 사용해야 합니다.
- 통과 조건: 로그인 사용자라도 OFF이면 실패 응답 및 파일/행 생성 0건; ON인 허용 사용자만 성공; 기존 동영상 정책 회귀 유지.
- 관련 헌법: 제3조의 서버 신뢰 경계 취지, 제7조.

### AUD-03 — 출시 증거가 실제 실행과 충분히 결합되지 않음

- 위치: [stable-evidence.mjs:196](../../scripts/stable-evidence.mjs#L196), [write-integration-evidence.mjs:21](../../scripts/write-integration-evidence.mjs#L21), [evidence-provenance.mjs:33](../../scripts/evidence-provenance.mjs#L33)
- 재현: 임시 fixture의 `instance-lifecycle.json`에 pass, 같은 버전, 0으로 된 40자리 commit, 2000년 관측일, 불일치 source fingerprint를 넣었습니다. 번들 해시만 검증기에 제공한 기대값과 같게 했습니다. 실행 보고서·관측 항목·스크린샷이 전혀 없어도 실제 `validateStableArtifact()`가 수락했습니다.
- 원인: 이 브라우저 분기는 commit/시간의 형식과 번들 해시를 확인하지만 실행 건수·실패/skip·결과 해시·요구사항별 결과·현재 source fingerprint를 확인하지 않습니다. `functional-audit.json` 등에 있는 추가 검증과 달리 수명주기/IME 등의 분기는 느슨합니다.
- 관련 공백: 새 Python 브라우저 실행은 `test-results/harness/browser-ui.json`을 생성하지만 출시 계약은 기존 `test-results/parity/browser/*.json`을 소비합니다. 새 실행 영수증이 기존 증거의 안전성을 자동으로 보장하지 않습니다.
- 관련 기록기: `write-integration-evidence.mjs`는 테스트 파일 7개의 소스 해시를 읽고 모두 pass로 기록하며 실행 결과를 받지 않습니다. check 기록기도 기존 unit/corpus 파일을 현재 fingerprint에 다시 묶을 수 있습니다. 정규 실행 경로에서 앞 단계가 성공하는 것과 기록기를 단독 실행해도 허위 통과를 못 만드는 것은 다른 통제입니다.
- 영향: 일부 요구사항이 미실행·오래된 증거로 통과할 수 있습니다. **이번 재현은 개별 증거 검증의 잘못된 통과이며, 62개 전체 우회나 실제 허위 배포를 실행한 것이 아닙니다.**
- 개선: 추적되는 runner의 실행 범위, 시작/종료 소스, 요구사항 ID, 실패/허용 skip, 결과 원본 해시를 하나의 계약으로 묶고 출시 검증기도 이를 소비해야 합니다. 실행하지 않는 pass 기록기는 폐기하거나 관측 전용으로 제한해야 합니다.
- 통과 조건: 실행 결과 없음·과거 commit/fingerprint·변조 결과·미필수 suite 실행·허용 밖 skip·수동 관측의 pass 승격이 모두 실패해야 합니다.
- 관련 헌법: 제9조, 제10조, 제15조, 제16조, 제17조.

### AUD-04 — 수명주기 쓰기 하네스의 전용 호스트 보호 누락

- 위치: [g7-lifecycle-evidence.sh:14](../../scripts/g7-lifecycle-evidence.sh#L14), [g7-github-lifecycle-evidence.sh:17](../../scripts/g7-github-lifecycle-evidence.sh#L17)
- 확인: 두 진입점은 제품 저장소와 다른 경로, artisan, 설치 표식, `APP_ENV=local`만 확인합니다. 새 `.jw-editor-harness.json`과 깨끗한 전용 checkout 확인을 호출하지 않습니다.
- 영향: 일반 로컬 G7 작업 저장소도 이 조건을 만족할 수 있으며 이후 `plugin:update --force --layout-strategy=overwrite`, 비활성화/제거/재설치가 실행됩니다. `integration-check.sh`에만 추가한 host-check로는 이 진입점을 보호하지 못합니다.
- 개선: 모든 G7 쓰기 진입점을 공통 Python preflight에 연결하고 표식·실제 경로·checkout 상태를 검증해야 합니다. 연속 수명주기 조작에는 실패 시 원상태 복원도 필요합니다.
- 통과 조건: 표식 없는 일반 checkout, 경로 위장, 허용되지 않은 dirty 상태를 전달하면 **첫 쓰기 명령 이전**에 실패해야 합니다. 공유 실제 G7에서 위험을 재현하지 말고 가짜 호스트/명령으로 먼저 검증해야 합니다.
- 관련 헌법: 제2조의 코어 무수정 경계, 제16조; AGENTS 전용 테스트 checkout 의무.

### AUD-05 — 배포 HTTP smoke 실패 시 복구 경로 없음

- 위치: [deploy.sh:87](../../scripts/deploy.sh#L87), [deploy.sh:141](../../scripts/deploy.sh#L141), [remote-deploy-transaction-test.mjs:9](../../scripts/remote-deploy-transaction-test.mjs#L9)
- 확인: 롤백 ERR trap은 원격 SSH 블록 내부에만 있습니다. 원격 활성화 후 trap을 해제하고 SSH가 끝난 다음, 로컬에서 HTTP `curl` smoke를 실행합니다.
- 영향: 그 HTTP 요청이 실패하면 배포 명령은 실패하지만 새 플러그인은 활성 상태로 남습니다. 실패한 배포를 성공으로 기록하지는 않지만, 헌법의 smoke 실패 후 역순 전환을 수행하지 못합니다.
- 테스트 공백: 기존 7개 transaction 테스트는 heredoc의 원격 부분만 추출하여 실행하므로 이 로컬 후속 실패를 포함하지 않습니다. 운영 장애를 실제 유발하지는 않았습니다.
- 개선: 원격 적용과 HTTP 검증을 하나의 상태 기반 트랜잭션으로 다루고, 실패 시 배포 전 활성 상태에 맞는 보상 동작과 복구 결과 확인을 수행해야 합니다. 현재처럼 CKEditor를 무조건 켜려는 fallback도 사전 상태와 구분해야 합니다.
- 통과 조건: 원격 적용 성공 후 HTTP 실패/타임아웃을 주입하면 안전한 이전 에디터 상태로 복구; 복구 실패는 별도 오류; 배포 pass 증거 생성 금지.
- 관련 헌법: 제8조, 제10조.

### AUD-06 — 이미지 업로드 중 편집하면 삽입 위치가 이동하지 않음

- 위치: [imageDropUpload.ts:15](../../resources/js/editor/imageDropUpload.ts#L15)
- 재현: `<p>abcdef</p>`의 `abc` 뒤에 이미지 드롭을 시작하고 업로드 응답을 지연했습니다. 응답 전에 맨 앞에 `PREFIX`를 입력했습니다.
- 결과: 의도한 `PREFIXabc [이미지] def`가 아니라 `PRE [이미지] FIXabcdef`로 삽입됐습니다. UI는 이미지 1개 삽입 성공을 표시했습니다.
- 원인: await 전 숫자 위치를 그대로 사용합니다. 문서 transaction에 따른 위치 매핑, 편집기 파괴 시 취소, 삽입 명령 성공 여부 확인이 없습니다.
- 개선: 기존 `automaticUrl.ts`/`dialog.ts`의 위치 추적 접근을 재사용 가능한 비동기 삽입 생명주기로 추출해야 합니다. 업로드 성공과 본문 삽입 성공을 구분해야 합니다.
- 통과 조건: 대기 중 앞/뒤 편집, undo, 다중 파일, 언어 전환, 편집기 해제에서도 의도 위치 보존 또는 명확한 취소; 거짓 성공 메시지 없음.
- 관련 헌법: 제7조, 제14조.

### AUD-07 — 기존 미디어 DOM의 옵션 변경 무시

- 위치: [mediaRenderer.ts:31](../../resources/js/editor/mediaRenderer.ts#L31)
- 재현: 동일한 YouTube figure에 `immediate/autoplay=true`로 렌더링한 뒤 `click/autoplay=false`로 다시 호출했습니다.
- 결과: iframe URL에 `autoplay=1&mute=1`이 유지됐고 클릭 로드 버튼도 생기지 않았습니다.
- 원인: 기존 player가 figure 자식이면 옵션을 비교하지 않고 continue합니다. 새 옵션으로 observer를 시작해도 기존 노드는 재구성되지 않습니다.
- 범위: **동일 DOM에 설정을 재적용하는 경로**의 결함입니다. 새로고침 후 생성되는 모든 플레이어에서 설정이 무시된다는 뜻은 아닙니다.
- 개선: `socialRenderer.ts`처럼 옵션/원본 signature를 관리하고 변경 시 이전 player 정리 후 재생성해야 합니다.
- 통과 조건: 동일 DOM에서 immediate↔click, autoplay ON↔OFF 전환 결과를 확인하고 중복 iframe/이벤트가 없어야 합니다.
- 관련 헌법: 제7조, 제14조.

### AUD-08 — TypeScript 금지 코딩을 검사기가 일부 수락

- 위치: [eslint.config.mjs:40](../../eslint.config.mjs#L40), [eslint.config.mjs:54](../../eslint.config.mjs#L54), [eslint.config.mjs:76](../../eslint.config.mjs#L76)
- 실제 ESLint `lintText`로 다음 canary를 검사했습니다. 저장소 제품 코드를 변경하지 않았습니다.

| 금지 입력                                          | 결과             |
| -------------------------------------------------- | ---------------- |
| `addEventListener`에 오류를 던지는 async 콜백 전달 | 오류 0           |
| policy에서 `../editor/locale` 상대 경로 import     | 오류 0           |
| 기존 toolbar 예외 파일에 신규 93줄 함수 추가       | 오류 0           |
| 일반 제품 파일에 동일한 93줄 함수 추가             | 함수 크기 오류 1 |

- 원인: `checksVoidReturn:false`가 이벤트 콜백의 Promise 미처리 검사를 끕니다. policy 경계 규칙은 alias만 제한합니다. 큰 함수 부채는 특정 기존 함수가 아니라 파일 전체의 상한을 늘립니다.
- 영향: 검사 자체는 통과하면서 신규 미처리 Promise, 역방향 의존, 새 대형 함수가 들어올 수 있습니다. 이 canary 결과가 모든 현재 이벤트 콜백의 실패를 의미하지는 않습니다.
- 개선: 비동기 이벤트 어댑터와 명시적 catch를 사용하고 콜백 검사를 켜야 합니다. 의존 경계는 해석된 경로로 검증하고 함수 예외는 정확한 기존 함수에만 적용해야 합니다.
- 통과 조건: 위 세 금지 입력 모두 오류; 기존 부채와 신규 코드를 구별; 경로 표기 변경/다른 위치의 신규 함수로 우회 불가.
- 관련 헌법: 제14조, 제15조.

### AUD-09 — 하네스 언어/파일 규약 스캔의 빈틈

- 위치: [governance.py:12](../../harness/jw_harness/governance.py#L12), [governance.py:64](../../harness/jw_harness/governance.py#L64), [governance.py:88](../../harness/jw_harness/governance.py#L88)
- 재현: 목록 밖 `harness/new-validator.mjs`를 실제 `inspect_source()`에 전달해도 오류가 없었습니다. 범용 JS 금지는 `scripts/`와 `harness/jw_harness/`에만 적용됩니다.
- 정적 확인: `.cjs`는 스캔 확장자에 없습니다. 루트 `plugin.php`와 `database/`, `lang/`, `routes/` 등도 이 소스 규약 스캔의 prefix 범위 밖입니다. 해당 코드에 다른 개별 검사가 존재하는 것과 규약 스캔의 전수 적용은 별개입니다.
- 영향: 폴더나 확장자만 바꿔 새 Node 하네스, 크기 초과, 금지 suppression을 이 규약 검사 밖으로 놓을 수 있습니다.
- 개선: 전체 first-party 실행 파일을 목록화하고 언어 전용 허용 목록과 범용 하네스 금지를 적용해야 합니다. 예외는 명시적으로 관리해야 합니다.
- 통과 조건: `harness/*.mjs`, `.cjs`, 새 하위 폴더, 루트 PHP 등에 금지 입력을 넣으면 적합한 검사에서 실패; 정당한 생성기/Playwright는 명시 허용.
- 관련 헌법: 제13조, 제14조, 제15조.

### AUD-10 — 미사용 이미지 정리 후보가 영구적으로 밀릴 수 있음

- 위치: [ImageUploadRepository.php:48](../../src/Repositories/ImageUploadRepository.php#L48), [ImageCleanupService.php:28](../../src/Services/ImageCleanupService.php#L28)
- 확인: 매번 생성일이 가장 오래된 limit개만 조회합니다. 참조 중인 항목은 남겨두고 다음 실행의 탐색 위치를 저장하지 않습니다.
- 재현 조건: 보존기한이 지난 앞 200개가 모두 참조 중이고 201번째가 미참조라면, 기본 limit 200의 정기 실행은 계속 같은 앞 200개를 검사합니다.
- 영향: 뒤의 미사용 업로드가 삭제되지 않아 저장 공간 정리가 완료되지 않습니다. 실제 사용자 파일을 삭제하며 테스트하지 않았습니다.
- 개선: 안정적인 cursor/scan window 또는 마지막 검사 상태로 전체 후보를 순회해야 합니다. 참조 파일을 지우는 것으로 해결하면 안 됩니다.
- 통과 조건: 첫 batch가 전부 참조 중이어도 후속 batch의 미참조 항목이 유한 횟수 안에 검사·정리되고 참조 항목은 보존돼야 합니다.
- 관련 헌법: 제7조.

### AUD-11 — 이미지 정리의 실패 종료 코드 누락

- 위치: [ImageCleanupService.php:43](../../src/Services/ImageCleanupService.php#L43), [PruneUnusedImagesCommand.php:59](../../src/Console/Commands/PruneUnusedImagesCommand.php#L59)
- 확인: 서비스가 파일 삭제 실패를 `failed`에 집계하지만 명령은 요약을 출력한 뒤 항상 SUCCESS를 반환합니다.
- 영향: 운영 스케줄러/실행기가 종료 코드로 실패를 감지할 수 없습니다. 실패 항목이 남았는데 작업 성공으로 처리됩니다.
- 개선: 실제 처리 실패가 있으면 실패 종료 코드를 반환하고, OFF/의도적 안전 skip/dry-run과 구분해야 합니다.
- 통과 조건: 저장소 삭제 실패를 주입하면 행은 보존되고 종료 코드는 실패; 정상 처리와 의도적 skip은 별도 계약대로 기록.
- 관련 헌법: 제7조, 제9조의 실행 결과 정확성.

### AUD-12 — SNS 결정적 회귀가 필수 CI에서 제외

- 위치: [browser.py:28](../../harness/jw_harness/browser.py#L28), [ci.yml:39](../../.github/workflows/ci.yml#L39), [social-embeds.spec.ts:89](../../tests/e2e/social-embeds.spec.ts#L89)
- 확인: 새 실행기는 `editor-*.spec.ts` 5개만 받습니다. 기존 `social-embeds.spec.ts`는 포함되지 않습니다.
- 빠진 검사: SDK mock을 쓰는 결정적 2개 테스트가 편집/조회 동일 표시, 반응형, SDK DOM 저장 금지, OFF 외부 실행 0건, 클릭 지연, 실패/재시도를 검사합니다. 별도의 실제 제공자 opt-in 테스트와 구분해야 합니다.
- 영향: 중요한 SNS 정책 회귀가 생겨도 새 필수 CI 경로에서 해당 테스트가 실행되지 않습니다. 이것이 현재 SNS 기능 전체가 실패한다는 뜻은 아닙니다.
- 개선: 결정적 SNS 검사를 필수 suite manifest에 포함하고 기대하는 테스트 ID/범위를 검증해야 합니다. 실통신 검사는 별도 opt-in 단계로 유지할 수 있습니다.
- 통과 조건: SDK 실행 OFF/저장 DOM 오염 등 의도적 결함에 required CI 실패; 실통신 skip이 결정적 검사 누락을 가리지 않아야 합니다.
- 관련 헌법: 제9조, 제15조, 제16조.

## 언어·큰 파일·재사용에 대한 판정

1. **주 하네스 Python 전환은 시작됐으나 전체 이전 완료는 아닙니다.** 새 Python 실행 모듈은 작게 분리돼 있고 Ruff/mypy/복잡도·함수 제한이 동작합니다. 반면 핵심 출시 증거 판정 등은 아직 Node에 남습니다. `legacyNode` 목록은 34개이며 여기에는 폐기 기록기와 유지할 언어 전용 도구도 있으므로 34개 전부를 무조건 Python으로 옮기라는 뜻은 아닙니다.
2. **큰 파일·큰 함수 부채가 남아 있습니다.** 파일 예외 4개는 toolbar 1,394줄, initEditor 524줄, stable-evidence-test 500줄, EditorSanitizer 561줄입니다. TS 함수 예외는 파일 단위 17개입니다. AST 원문 범위로 측정한 제품 함수/콜백 중 80줄 초과는 28개이며 `installWritingTools` 429줄, `createEditorToolbar` 275줄, `createImageUploadQueue` 267줄 등이 포함됩니다. 단순 줄 수를 잘게 잘라 옮기는 대신 UI/명령/상태/통신 책임을 분리해야 합니다.
3. **기존 예외는 정상화 승인이 아닙니다.** 부채의 담당은 `jw-editor maintainers`, 만료는 2026-10-17입니다. 만료 검사는 있지만 AUD-08 때문에 기존 파일 내 신규 큰 함수까지 막지는 못합니다.
4. **재사용 기반은 존재합니다.** 정책 생성기, G7 인증 헤더 어댑터, media player, class token, 기능 모듈은 재사용 가능합니다. 업로드 위치 추적처럼 기존 URL/대화상자와 유사한 상태 처리를 별개 구현한 부분은 통합할 가치가 있습니다.
5. **의미적 중복과 UI 문구 의존은 아직 부채입니다.** [toolbar.ts:133](../../resources/js/editor/toolbar.ts#L133)의 아이콘 선택은 [icons.ts:115](../../resources/js/editor/icons.ts#L115)의 한글/번역 문구 매핑에 의존합니다. 문구 변경으로 아이콘이 없어질 수 있으므로 명시적 icon/command ID가 필요합니다. provider 분류도 client runtime policy, PHP sanitizer, link preview service에 흩어져 있어 정책 SSoT 확장 후보입니다. 현재 허용 정책이 모두 불일치한다고 단정하지는 않습니다.
6. **타입스크립트 자체가 문제는 아닙니다.** strict 설정과 타입 검사는 실제로 동작합니다. 남은 문제는 상태 경계, 비동기 생명주기, 예외 범위, 검사기와 실행 증거의 연결입니다. 언어를 바꾸기만 해서는 해결되지 않습니다.

## 이번에 실제 실행한 검사

| 검사                                                          | 이번 결과                | 해석                                                                        |
| ------------------------------------------------------------- | ------------------------ | --------------------------------------------------------------------------- |
| `make check`                                                  | 통과                     | 아래 범위의 현재 소스 검사                                                  |
| Python 테스트                                                 | 30개 통과                | 신규 규약/하네스 경계 테스트                                                |
| Vitest                                                        | 28파일, 240개 통과       | 제품 단위 회귀                                                              |
| Ruff / mypy / typed ESLint / strict TypeScript                | 통과                     | 규칙 공백 AUD-08/09는 별도 존재                                             |
| PHPStan level 5                                               | 설정된 독립 영역 통과    | sanitizer/content/social/policy/value/exception 범위, G7 의존 PHP 전수 아님 |
| PHP 문법·standalone corpus/계약 / Node 경계 검사 / ShellCheck | 통과                     | 실제 G7 저장·설치 검증과 다름                                               |
| `make audit`                                                  | 통과                     | npm/composer advisory 없음, 고정 Python 의존성 7개 advisory 없음            |
| 기존 final gate                                               | blocked, 기계 판정 20/62 | 최신 통합/패키지/수명주기/배포 관련 증거 등 42개 미충족                     |
| 격리 canary/probe                                             | 결함 재현                | 통과 증거가 아니라 위 결함의 진단 근거                                      |

final gate 수치는 보고서 작성 전 clean 상태에서 확인했습니다. 42개 미충족은 기능 42개 고장을 뜻하지 않습니다. 반대로 기계가 인정한 20개도 AUD-03의 증거 수락 결함 때문에 전체적으로 신뢰가 확정된 인증 수치가 아닙니다.

이번 Vitest coverage는 lines 72.66%, statements 70.51%, branches 59.88%, functions 69.23%입니다. `imageDropUpload.ts` 단위 line coverage는 0%이며 AUD-06의 경쟁 상황이 빠져 있습니다. 커버리지 수치는 기능 완성률이 아닙니다.

이전 작업의 브라우저 실행 결과를 이번 실행으로 재보고하지 않습니다. 이번에는 `make browser-check`, G7 integration, package/release-check, staging/production smoke를 실행하지 않았습니다.

GitHub main 보호는 읽기 전용으로 재조회했습니다. 관리자 적용, Actions app 15368의 `validate` 필수, strict, 강제 push 금지는 유지됩니다. 필수 승인 리뷰 수는 0입니다. 따라서 2인 코드 리뷰가 강제된다는 의미는 아니며, 로컬 작업 브랜치의 새 workflow가 원격에서 실행 완료됐다는 의미도 아닙니다.

## 헌법 조항별 감사 판정

| 조항                 | 판정                                                                      |
| -------------------- | ------------------------------------------------------------------------- |
| 1 제품 목적          | CKEditor 대체 범위 유지. Office/별도 문서 서비스 확장은 감사 범위 밖      |
| 2 코어 무수정        | 이번 작업에서 코어 변경 없음. 일반 G7 작업 공간 보호는 AUD-04 보강 필요   |
| 3 서버 신뢰 경계     | canonical 서버 검사 존재. 이미지 OFF 집행 AUD-02 미흡                     |
| 4 최소권한 HTML      | 정책 생성/동기화와 corpus 통과. 모든 입력의 무결함 증명은 아님            |
| 5 기존 데이터        | AUD-01 부적합                                                             |
| 6 자체 호스팅/공급망 | advisory 검사 통과. ADR-0014 공식 SDK 예외 위험은 기존 승인 경계          |
| 7 완전 대체          | 기능/운영 결함과 최신 G7 증거 미충족으로 승인 불가                        |
| 8 공존/전환          | smoke 실패 복구 AUD-05 미흡. 실제 관리자 전환은 이번 미검증               |
| 9 증거 기반 출시     | AUD-03/12로 불충분                                                        |
| 10 실패 폐쇄 배포    | 현재 gate는 blocked. AUD-03/05 때문에 충분한 안전 통제로 판정 불가        |
| 11 비밀/개인정보     | 대상 키워드 정적 스캔 범위의 점검만 수행. 모든 비밀 유형 무검출 보증 아님 |
| 12 변경 절차         | 이번에는 규약 변경 없이 감사 보고서만 추가                                |
| 13 언어와 책임       | Python 진입점 존재, Node 이전 부채와 AUD-09 남음                          |
| 14 유지보수          | AUD-06/08/09 및 큰 함수·문구 의존·중복 부채 남음                          |
| 15 검사/CI           | 검사 실행 확인. AUD-08/09/12의 금지 사례 차단 공백                        |
| 16 증거/작업 공간    | AUD-03/04 부적합                                                          |
| 17 정식 공개         | 별도 Python 정식 공개 경로 존재하나 소비 증거 AUD-03 보강 전 승인 불가    |

## 권고 수정 순서와 종료 조건

1. **데이터·서버 설정:** AUD-01/02. 먼저 실패하는 회귀 테스트를 추가하고, 다국어 원문 보존 및 업로드 OFF의 실제 HTTP 거부까지 확인합니다.
2. **검증·실행 안전:** AUD-03/04/05. 증거 소비 경로를 통일하고 모든 G7 쓰기 진입점과 배포 smoke 실패를 검증합니다. 파일 해시만 다시 찍어서 pass를 만들면 안 됩니다.
3. **편집/운영 상태:** AUD-06/07/10/11. 비동기 삽입, 옵션 재적용, 청소 순회/실패 보고를 각각 회귀로 고정합니다.
4. **재발 차단:** AUD-08/09/12 및 큰 함수/중복 부채. 신규 금지 입력을 실제 차단하고 결정적 SNS 테스트를 CI 필수 범위에 넣습니다.

각 수정 차수는 관련 회귀와 기본 검사를 통과해야 하며, 마지막에 전용 G7 실제 저장/재조회·설치/업데이트/롤백, 동일 패키지의 단계별 gate를 다시 수행해야 합니다. 후보 57개, staging 전 60개, production 전 61개, 최종 stable 62개라는 기준은 변경하지 않습니다.

**이번 감사 종료는 수정 완료가 아닙니다.** 현재 결과만으로 정식 배포 가능, 모든 기능 정상, 헌법 전수 준수라고 보고할 수 없습니다.
