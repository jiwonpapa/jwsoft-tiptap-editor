# Changelog

모든 주요 변경은 이 파일에 기록합니다. 형식은 Keep a Changelog와 Semantic Versioning을 따릅니다.

## [Unreleased]

### Fixed

- 관리자 설정의 카드·입력·설명·경고·버튼·선택 메뉴를 G7 색상 토큰으로 연결하고 테마 스타일을 플러그인 화면에 한정. 에디터·모달·글보기에서 `dark` class와 `data-theme="dark"` 모두 지원. 모바일 경고 제목·본문은 세로 배치
- 실제 게시판 저장·조회 검사에서 발견한 제목·인용 서식 소실과 체크리스트 중복 목록 기호를 수정. 편집·조회 문서 스타일을 공통화하고 밝은 화면·다크모드에 동일하게 적용
- 글자색과 강조색을 함께 지정하면 글자색이 덮이던 CSS 우선순위를 수정하고, 표 셀 세로 정렬 등 허용 토큰이 기본 요소 스타일보다 우선하도록 범위를 한정
- 완료한 체크리스트에서 Enter로 만든 새 항목은 미완료로 시작하도록 수정

### Tests

- 데스크톱·모바일에서 실제 계산된 서식과 체크리스트 Enter 동작을 회귀 검사. 릴리스 gate의 글자·표 항목에 편집·조회 표시 증거를 필수로 추가

## [0.1.1-rc.1] - 2026-09-01

### Fixed

- MP4 플레이어가 모든 영상을 16:9 외곽에 넣던 표시 결함을 수정. 브라우저가 해독한 실제 가로·세로 크기로 에디터와 글보기의 외곽 종횡비를 동일하게 맞추고, 세로·정사각 영상은 콘텐츠 폭과 모바일 화면을 넘지 않는 제한 폭을 적용
- 실제 세로 MP4 fixture와 데스크톱·모바일 회귀 검사를 추가하고, 런타임 비율 style·class가 canonical 저장 HTML에 들어가지 않음을 검증

## [0.1.0] - 2026-09-01

### Changed

- 승인된 G7 `sirsoft-ckeditor5` 대체 범위를 기능 동결하고 `0.1.0` 정식 릴리스 검증을 시작
- Office·Google Docs 문서 변환, 협업·댓글·버전 비교, AI 작성, 페이지 빌더, 임의 외부 실행 HTML과 legacy inline style 일괄 마이그레이션은 제품 범위 밖임을 유지

### Security

- canonical HTML 서버 정제, class token 화이트리스트, URL·업로드·SSRF 검증 및 X·Facebook 공식 게시물 화이트리스트 정책 유지

## [0.1.0-rc.4] - 2026-08-31

### Fixed

- 제목 Enter의 미처리 기본 GET 제출을 에디터 연결 폼에서 차단; 제목 보존·본문 필수 안내·편집 포커스를 제공하고 기존 저장 버튼·명시적 submit·서버 검증은 유지 (ADR-0013)
- 편집 화면에서도 YouTube·Vimeo·업로드 MP4를 글보기와 동일한 실제 플레이어로 표시; 삽입·재편집·기능 OFF 상태의 기존 미디어에 적용하고 선택·삭제·재생 조작을 분리
- 플레이어의 재생 DOM은 저장하지 않고 기존 canonical figure/link 형식을 유지; 무관한 본문 수정으로 플레이어를 다시 생성하지 않으며 삭제·편집기 종료 시 재생 자원을 해제

### Changed

- X·Facebook 화이트리스트 게시물의 공식 SDK 표시 및 제공자별 ON/OFF 추가 (ADR-0014, 정책 1.6.0). 링크/SNS 카드 master ON 사이트는 업그레이드 후 공식 표시가 적용되며 외부 코드 실행과 제공자 연결이 발생함. click 로드 선택은 유지하고 OFF는 원문 카드로 표시
- 외부 플레이어의 신규 기본값을 즉시 표시로 변경하고 편집·조회에 같은 설정을 연결. 자동재생은 기본 OFF를 유지하며, 기존에 저장된 클릭 후 로드 선택은 임의 변경하지 않음

## [0.1.0-rc.3] - 2026-08-31

### Fixed

- RC2 실제 상품 검사에서 발견한 빠른 언어 전환 시 이전 언어 입력 유실 수정: 언어별 debounce 키를 분리하고 즉시 저장·리사이즈·빈 번역을 실제 G7 엔진으로 회귀 검증
- 같은 후보의 실제 한영 전환·저장 보존도 필수 기능 gate에 포함; RC2 후보는 원격 미배포 상태로 보존

## [0.1.0-rc.2] - 2026-08-31

### Fixed

- 단독 URL 직접 입력 후 Enter와 빈 문단 붙여넣기의 자동 미디어/카드 변환, 요청 중 URL 보존·문서 변경 위치 추적·삭제/종료 시 취소·실행취소 원본 복구
- SNS 조회 거부·메타데이터 없음은 빈 성공 카드 대신 실패 처리; 원본 링크 유지와 모달 재시도/원본 삽입 제공

### Changed

- 실제 공개/관리자 이미지 업로드, 빈 본문 HTTP 거부, MP4 시간 증가/Range, URL 저장 왕복 증거를 같은 후보 ZIP에 연결한 필수 배포 gate 추가

### Fixed

- 비동기 G7 본문 출력·재렌더 뒤 MP4/YouTube/Vimeo 플레이어를 다시 연결; 로컬 MP4는 즉시 native controls, 외부 영상은 클릭 로드 정책을 유지하고 원본 링크·감지 가능한 오류 재시도를 제공
- 영상 업로드에 파일명·바이트 진행률·서버 처리 상태 표시, 원래 `.mp4` 파일명을 본문/응답에 보존; 취소 예외 재시도를 중단하고 로컬 파일 구간 요청을 표준 BinaryFileResponse로 지원
- 공개 Basic의 파일 선택 이벤트 객체와 Admin Basic의 배열 콜백을 모두 지원; 실제 파일 입력이 나타나야 fallback을 숨기고 업로더 소실 시 복구, 파일명·진행률과 `업로드 후 삽입` 동작을 명확히 표시
- 실제 파일 검증 오류에서 번역 키가 그대로 노출되던 경로를 수정; 기존 번역 JSON을 서버 메시지에도 연결하고 용량 치환자를 검증
- 빈 문단·공백·제로폭 문자·빈 표만 있는 HTML을 서버에서 빈 값으로 정규화하여 G7 게시판 필수 검증을 적용; 이미지/영상 전용 글과 선택 항목·비어 있는 번역은 유지
- 입력 직후 모두 삭제하거나 원래 값으로 되돌리면 보류 중인 G7 debounce 값을 마지막 입력으로 교체; 실제 HTTP 빈 본문 거부 18개와 빠른 삭제 제출 회귀 추가
- 본문 debounce 완료 시 G7 공개 상태 API로 제출용 폼 스냅샷도 갱신하여 반응형 렌더 후 과거 본문이 제출되는 경로를 보완; 실제 G7 엔진과 에디터 소스를 함께 사용하는 신규·수정·다국어·즉시 저장 회귀 검사를 추가

### Changed

- `0.1.0-rc.1`, ADR-0012: 소유자 승인에 따라 후보 57개 → 사전 60개 → staging 포함 61개 → production 포함 62개로 출시 순환 조건을 해소; 동일 ZIP·같은 대상 명시 승인·단계별 실제 적용 이력과 원격 변경 전 최신 증거 gate를 적용
- `0.1.0-alpha.21` 개발·staging 후보: 글자·목록·문단 메뉴 분리와 모바일 하단 시트, 상시 undo/redo, 최신 증거 검증을 별도 버전으로 패키징; 기존 alpha.20 릴리스 산출물은 변경하지 않음
- stable 집계에서 과거 버전의 pass JSON을 재사용하지 않도록 소스·실행 번들·재현 ZIP·screenshot 해시를 대조하고 항목별 미검증 사유를 기록; 모바일 증거도 새 접힘 툴바의 가로 넘침 없음 기준으로 갱신
- 더보기에는 찾기/바꾸기·전체화면만 남기고 글자·목록·문단 메뉴를 분리; 메뉴 항목에 이름·선택 표시를 제공하고 표 편집은 선택 대상 도구로 통합
- 삽입 그룹의 실측 폭 기반 접힘, 실행취소/다시실행 상시 노출, 모바일 서식 하단 시트와 키보드 포커스 순환·선택 영역 복원을 적용; 입력 모달과 메뉴 중첩 및 전체화면 Escape 충돌 방지
- G7 업데이트 후 이미 활성화된 플러그인에 대한 재활성화 오류를 피하고, 배포 시 PluginRepository의 실제 단일 에디터 활성 상태를 검증
- 정책 1.5.0: 선택 글자 크기·색·강조색, 위/아래 첨자, 체크리스트, 양쪽 정렬, 셀 배경·세로 정렬·표 테두리와 5% 단위 이미지 크기를 허용 토큰으로 추가; 임의 style/class 저장 금지는 유지
- 표/이미지/선택 영역 문맥 도구, 이미지 드래그·키보드 크기 조절, 찾기·바꾸기, 서식 지우기, 문자 수·전체화면을 추가하고 최소 툴바에도 밑줄·이미지를 제공
- MP4 입력을 URL/업로드 탭과 드롭존으로 정리하고 영상·링크 카드의 모달 취소 후 늦은 삽입을 차단
- 에디터 툴바를 자체 호스팅 Lucide SVG와 반응형 더보기 메뉴로 교체하고, 기본 기술 상태 문구를 작성 영역에서 제거
- 이미지 삽입을 실제 top-layer 모달로 전환: 본문 위치 유지, 포커스 복귀·ESC 닫기·선택 영역 보존, 파일/URL 탭과 접힌 상세 설정
- G7 공개 React/component registry의 FileUploader를 파일 선택 UI로 재사용하고 기존 이미지 API에 연결; 미지원 템플릿은 같은 동선의 드롭존 fallback 제공
- 이미지 다중 선택 목록·미리보기·진행률·재시도·취소를 추가하고 닫힌 모달에서 늦게 완료된 업로드가 본문에 삽입되지 않도록 보호
- 활성화 전에 열 수 없는 설정의 위험 확인 스위치를 제거하고, 설정 화면 경로 및 고정 식별자의 GET/PUT 연결을 등록
- 설치·활성화·조회는 기존 저장 본문을 바꾸지 않으며 기존 글을 JWSoft에서 수정 후 저장할 때 서식 변경 가능함을 설명·설정·문서별 경고에 명시; 새 글·읽기 전용 무경고와 서버 정제·문서별 확인은 유지
- 에디터 충돌 오류에 현재 에디터, 관리자 플러그인 위치, 비활성화 후 재시도와 복귀 절차를 명시; 관리자에서 묵시적 에디터 전환 금지
- 전환 실패 복귀 후 배포 명령이 성공으로 끝나지 않도록 원래 실패 코드를 유지하는 회귀 검사 추가
- 승인된 원격 staging G7 7.0.9에 `alpha.18` 최초 설치와 원본 파일·콘텐츠 해시 보존을 확인; 기존 콘텐츠 전환 위험 미확인으로 JWSoft 활성화는 보류하고 CKEditor 유지
- 배포 하네스에서 SSH 사용자·앱 소유자와 배포 역할·Laravel 실행 모드를 분리하고, 최초 ZIP 설치의 중첩 경로 오류 및 기존 pending 삭제를 방지; 전환 위험 미확인 시 설치 후 활성화만 보류
- 원격 변경 전에 `EXPECTED_APP_ENV`, production `APP_DEBUG=false`, Laravel cache·log·plugin 재귀 쓰기 권한과 install/update 실제 상태를 확인하는 무변경 배포 preflight 추가
- staging smoke 증거와 production 동일 checksum을 비식별 지문으로 기록하고 production 전에 로컬 staging 증거까지 재검증하는 배포 gate 추가
- G7 공개 renderer의 서버 내부 API 호출을 수용하는 멀티워커 하네스에서 상품·페이지 canonical HTML 출력까지 검증해 stable readiness를 60/62로 갱신
- `0.1.0-alpha.18`: 공개 GitHub 최초 설치, `alpha.16 → alpha.18` 태그 업데이트, 무데이터 삭제 uninstall, CKEditor 롤백·JWSoft 복구와 콘텐츠 해시 보존을 전용 G7 7.0.9에서 검증
- 전용 G7 7.0.9에서 공개·관리자 게시판 create/edit/reply/show와 direct `HtmlEditor` fallback 실브라우저 증거를 추가
- 관리자 설정·업로드 메뉴의 G7 권한 계약을 고정하고 오류 로그에서 업로드 세션 토큰과 내부 파일 경로를 제거
- 관리자 이미지 목록이 요청 page를 정확히 적용하고 게시글·상품 설명·상품 공통정보·페이지의 참조를 판정하며 단건·일괄 삭제의 파일·DB 결과와 경합 누락 ID를 통합 검증
- G7 7.0.9의 모든 `html_editor` 교체 저장 endpoint 11개를 공통 서버 sanitizer로 보호하고 다국어 HTML map도 locale별 canonical 정제
- Chromium 입력 계층의 실제 한글 composition, 브라우저 Clipboard API 정제 붙여넣기, 툴바·단축키 undo/redo와 최종 G7 상태 동기화를 하나의 브라우저 증거로 검증
- 정책 `1.4.0` image figure에 caption·좌/중앙/우 정렬·25/50/75/100% 반응형 크기 편집을 추가하고 기존 단독 이미지는 무변환 왕복
- 정책 `1.3.0`의 4단계 들여쓰기 class token과 들여쓰기/내어쓰기 도구를 추가하고 목록에서는 중첩 list 구조를 사용
- DOM에서 분리된 editor를 자동 파기하고 BFCache를 보존하는 pagehide 정리를 추가해 화면 이동 100회에도 동시 instance를 1개 이하로 유지
- 런타임 build metadata가 plugin manifest 버전을 단일 정본으로 사용해 설치 버전과 실행 버전의 불일치를 방지
- 다국어 탭 전환 시 이전 locale 인스턴스를 정리하고 편집 내용을 보존해 동시 Tiptap 인스턴스를 1개로 제한
- 실제 G7 board·ecommerce·page의 create/re-edit 전 경로를 현재 버전 screenshot·접근성·성능·단일 instance 증거로 기록
- 412px 모바일 다크 테마에서 페이지 가로 넘침 없이 툴바 스크롤과 단일 editor instance를 검증
- G7 GitHub 최초 설치의 `main` 폴백과 태그 기반 온라인 업데이트 경계를 설치·테스트 문서에 분리
- GitHub Release workflow에서 alpha 출시 후보 게이트와 stable 전수 게이트를 분리해 alpha 태그에 stable 승인을 오표기하지 않도록 개선
- 공개 GitHub `main` 최초 설치·이전 ZIP에서 온라인 업데이트·데이터 보존 uninstall·CKEditor 롤백을 전용 G7에서 검증하는 수명주기 gate 추가
- stable P0 62개에 고유 evidence ID를 부여하고 unit·G7 통합 산출물과 대조하는 fail-closed readiness gate로 교체
- G7 통합 증거에 MP4와 SSRF 방어형 링크 미리보기 검사를 포함
- 의존성 입력이 같으면 `vendor-bundle.json` 생성 시각을 보존해 패키징 후 Git 트리가 불필요하게 변경되지 않도록 개선
- `0.1.0-alpha.12`: G7 GitHub 설치 과정에서 `_pending`과 활성 경로의 동일 진입점이 한 프로세스에 로드될 때 class 재선언을 방지
- `0.1.0-alpha.11`: GitHub 저장소를 public으로 전환하고 G7의 GitHub URL 설치에 필요한 빌드 JS·Composer vendor bundle을 공개 source archive에 포함
- 공개 열람과 Proprietary 사용권을 분리하고 개발·staging 온라인 설치 절차를 문서화

### Added

- 독립 GitHub 저장소와 로컬 개발 환경
- 제품 헌법, MVP 기획, 아키텍처, 보안, 설치, 테스트, 배포 문서
- manifest·policy·문서·빌드 검증 하네스
- CKEditor 완전 대체 parity gate와 배포 fail-closed 골격
- G7 `html_editor`·`html_content` replace extension과 Tiptap lifecycle adapter
- 단일·다국어 content, read-only·disabled·height, G7 debounce state sync 계약
- CKEditor 동시 활성화 서버·브라우저 이중 차단과 adapter 단계 read-only gate
- `editor-policy.json`에서 TypeScript·PHP·DOMPurify·token CSS를 생성하는 checksum codegen
- Symfony 기반 canonical HTML sanitizer와 G7 7.0.9 게시판·상품·페이지 전체 편집 저장 미들웨어
- 위험 태그·속성·URL·임의 class 제거, 문서·표 상한, 정책 오류 fail-closed 응답
- legacy HTML 손실 사전 경고와 사용자 확인 전 저장 차단
- 출력 `HtmlContent` DOMPurify allowlist와 브라우저 보안 corpus
- `minimal`·`standard`·`full` 반응형 툴바와 키보드 포커스 이동
- 선택 영역 글자 서식, 문단 H2~H4, 인용·목록·코드·구분선·실행취소/다시실행
- inline style 없이 정책 `jw-*` class token만 출력하는 문단 크기·정렬·줄 간격
- 정책 URL 검증을 공유하는 링크·표·URL 이미지 대화상자와 표 편집 명령
- 붙여넣기 HTML 선제 정제, 손실 안내와 실행취소 경로
- G7 StorageInterface 기반 이미지 업로드·공개 서빙·업로드 레코드
- 업로드 설정, 관리자 조회·단건·일괄 삭제, opt-in 미참조 이미지 정리
- `jwsoft-tiptap-editor.image.*` 훅과 기존 `sirsoft-ckeditor5.image.*` 호환 별칭
- 훅 변환 뒤 MIME·크기·픽셀 재검증과 DB 실패 시 물리 파일 회수
- 에디터 인라인 업로드 상태 UI와 mock API Chromium 업로드 흐름
- G7 식별자 기반 네임스페이스 호환 브리지와 실제 ZIP 설치 계약 검사
- board·ecommerce·page 브라우저 동등성, legacy/security corpus, 성능 예산 증거 하네스
- 한국어·영어 편집기 상태·툴바·대화상자 UI
- ZIP 업데이트·CKEditor 전환·롤백 증거와 artifact provenance parity gate
- G7 7.0.9 CLI 활성화 우회 경로의 CKEditor 자동 롤백과 활성 상태 기반 대칭 충돌 guard
- 실제 인증 G7 한국어·영어 재편집 screenshot 및 route-to-editor 성능·단일 instance evidence
- Proprietary 제품 라이선스와 lockfile 기반 third-party notices
- 런타임 NPM 원문 라이선스·Composer manifest가 포함된 self-contained ZIP
- 동일 commit epoch 2회 checksum을 강제하는 재현 패키지 gate
- 전체 P0 미완료 시 stable을 차단하는 readiness gate와 별도 alpha release-candidate gate
- CKEditor 비활성화 후 JWSoft 활성화를 보장하는 배포 순서 계약 검사
- 기존 콘텐츠 전환 위험 설정의 명시적 확인 전 활성화 차단, 문서별 재경고와 CKEditor 복귀 안내
- 설정 가능한 다중 이미지 드래그·드롭 및 클립보드 업로드
- 설정 가능한 YouTube·Vimeo·MP4 URL 자동 감지와 저장 HTML 무실행 반응형 플레이어
- 설정 가능한 MP4 청크 업로드, SHA-256 조각 검증·재시도·재개와 만료 세션 자동 정리
- 설정 가능한 Instagram·X·TikTok·Facebook·Threads·일반 URL 스마트카드와 SSRF 방어형 서버 미리보기
