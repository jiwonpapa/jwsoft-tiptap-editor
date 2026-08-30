# sirsoft-ckeditor5 완전 대체 동등성

이 문서의 `P0` 항목이 모두 자동화 증거와 함께 통과해야 stable을 출시할 수 있습니다. 각 체크 항목의 `p0` ID는 `harness/contracts/stable-readiness.json`과 연결되며, 단순 체크 표시만으로 완료 처리되지 않습니다.

공개 `alpha.18`은 전용 G7 7.0.9에서 release-candidate 계약, 재현 가능한 ZIP, GitHub 최초 설치, `alpha.16 → alpha.18` 온라인 업데이트, CKEditor 롤백과 콘텐츠 해시 보존을 검증했습니다. instance 수명주기·구조 편집·반응형 이미지 배치·브라우저 입력 계층, G7의 모든 `html_editor` 교체 저장 endpoint 서버 정제와 관리자 이미지 목록·참조 판정·삭제도 통과했습니다. 실제 브라우저에서 공개·관리자 게시판, 상품, 페이지와 direct `HtmlEditor` fallback까지 통과하여 현재 stable readiness는 60/62입니다. 상품·페이지 공개 출력은 G7의 서버 내부 API 호출을 수용하는 멀티워커 하네스와 fresh cache key에서 canonical HTML을 확인했습니다. 아래 `[x]`는 현 checkout의 자동화 산출물로 재검증되는 범위이고, `[ ]`는 staging·production 증거가 남은 stable 차단 항목입니다.

## A. 편집기 교체

- [x] `html_editor` replace extension 제공 <!-- p0:editor.extensions.html -->
- [x] `html_content` replace extension 제공 <!-- p0:content.extensions.html -->
- [x] content/value/name/placeholder/readOnly/disabled/height 호환 <!-- p0:editor.bindings -->
- [x] 단일 문자열·다국어 map 호환 <!-- p0:editor.multilingual -->
- [x] mount/unmount와 화면 이동 시 instance 누수 없음 <!-- p0:editor.instance-lifecycle -->
- [x] G7 state sync debounce와 최신 상태 재조회 <!-- p0:editor.state-sync -->

## B. 편집 기능

- [x] minimal/standard/full toolbar profile <!-- p0:editor.toolbar-profiles -->
- [x] 제목, 문단, bold, italic, underline, strike <!-- p0:editor.text-formatting -->
- [x] 링크, 인용, 목록, 정렬, 들여쓰기 동등 동작 <!-- p0:editor.indentation -->
- [x] 표 생성·편집 <!-- p0:editor.table -->
- [x] 이미지 업로드·caption·정렬·크기 <!-- p0:editor.image-layout -->
- [x] code block, 원문 HTML 편집 금지 정책, horizontal rule <!-- p0:editor.source-policy -->
- [x] undo/redo, 붙여넣기, 실제 한글 IME <!-- p0:editor.ime -->

## C. 정책과 보안

- [x] 서버 sanitizer가 모든 저장 endpoint에 적용 <!-- p0:security.server-endpoints -->
- [x] `style`, 이벤트 속성, 미등록 class 저장 0 <!-- p0:security.attributes -->
- [x] 위험 URL·SVG·form·script·임의 iframe 차단 <!-- p0:security.dangerous-content -->
- [x] DOMPurify 생성 allowlist 출력 <!-- p0:security.client-allowlist -->
- [x] security corpus 전체 통과 <!-- p0:security.corpus -->
- [x] 정책 오류 시 fail closed <!-- p0:security.fail-closed -->

## D. 이미지 하위 시스템

- [x] 업로드 인증·권한·크기·MIME 검증 <!-- p0:image.validation -->
- [x] StorageInterface 사용 <!-- p0:image.storage -->
- [x] 이미지 serve route와 cache header <!-- p0:image.serve -->
- [x] 업로드 레코드와 참조 상태 <!-- p0:image.records -->
- [x] 관리자 목록·단건·일괄 삭제 <!-- p0:image.admin -->
- [x] 미사용 이미지 cleanup opt-in과 retention <!-- p0:image.cleanup -->
- [x] before/after/filter/reference source 훅 동등성 또는 명시적 호환 alias <!-- p0:image.hooks -->
- [x] 외부 이미지/업로드 실패/고아 파일 처리 <!-- p0:image.failure-orphans -->

## D-1. 미디어 하위 시스템

- [x] YouTube·Vimeo·MP4 URL provider allowlist <!-- p0:media.providers -->
- [x] 저장 HTML에 iframe·video·script 0 <!-- p0:media.canonical -->
- [x] 출력 player 클릭 후 로드·반응형·자동재생 opt-in <!-- p0:media.player -->
- [x] provider 설정 OFF와 기존 media node 무손실 <!-- p0:media.settings -->
- [x] MP4 청크 해시·재시도·재개·서버 재검증 <!-- p0:media.chunk-upload -->
- [x] 중단 업로드 24시간 만료 정리와 완성 파일 serve <!-- p0:media.cleanup -->

## D-2. 링크 스마트카드

- [x] Instagram·X·TikTok·Facebook·Threads·일반 HTTPS provider 분류 <!-- p0:cards.providers -->
- [x] 붙여넣기 자동 변환·툴바 수동 삽입·실패 시 원 URL 보존 <!-- p0:cards.insert -->
- [x] DNS·redirect 공개 IP 검증과 연결 IP 고정 <!-- p0:cards.ssrf -->
- [x] 저장 HTML에 provider script·iframe·임의 embed 0 <!-- p0:cards.canonical -->
- [x] 기능 OFF와 기존 canonical card 무손실 <!-- p0:cards.settings -->

## E. G7 관리 기능

- [x] imageUpload, imageMaxSizeMb, videoUpload, videoMaxSizeMb, videoChunkSizeMb, smartCards, autoSmartCards, editorHeight, toolbar 설정 <!-- p0:settings.editor-media -->
- [x] public asset disk 설정 <!-- p0:settings.asset-disk -->
- [x] cleanup 설정 <!-- p0:settings.cleanup -->
- [x] 관리자 메뉴와 read/delete 권한 <!-- p0:settings.admin-permissions -->
- [x] 활동 로그·오류 로그에 비밀·본문 원문 노출 없음 <!-- p0:settings.safe-logging -->

## F. 대상 화면

- [x] 공개 게시판 create/edit/reply/show <!-- p0:surfaces.public-board -->
- [x] 관리자 게시판 create/edit/show <!-- p0:surfaces.admin-board -->
- [x] 쇼핑몰 상품 description create/edit/show <!-- p0:surfaces.ecommerce -->
- [x] 페이지 create/edit/show <!-- p0:surfaces.page -->
- [x] 모바일·다크모드·다국어 <!-- p0:surfaces.mobile-dark-i18n -->
- [x] direct HtmlEditor fallback 화면 무회귀 <!-- p0:surfaces.fallback -->

## G. 수명주기

- [x] source 설치, ZIP 최초 설치 <!-- p0:lifecycle.install-sources -->
- [x] ZIP/GitHub update와 upgrade step <!-- p0:lifecycle.github-update -->
- [x] activate/deactivate/uninstall <!-- p0:lifecycle.uninstall -->
- [x] CKEditor 동시 활성화 차단 <!-- p0:lifecycle.conflict -->
- [x] CKEditor → jwsoft 전환 smoke <!-- p0:lifecycle.switch-to-jwsoft -->
- [x] jwsoft → CKEditor 롤백 smoke <!-- p0:lifecycle.rollback-to-ckeditor -->
- [x] legacy HTML 왕복과 손실 보고 <!-- p0:lifecycle.legacy-roundtrip -->

## H. 공급망과 배포

- [x] CDN 요청 0 <!-- p0:supply-chain.no-cdn -->
- [x] npm/composer lock과 audit 통과 <!-- p0:supply-chain.locks-audit -->
- [x] reproducible build 또는 산출물 checksum 동일성 <!-- p0:supply-chain.reproducible -->
- [x] package manifest·vendor·dist 포함 <!-- p0:supply-chain.package -->
- [ ] staging 배포와 smoke <!-- p0:deploy.staging -->
- [ ] production은 staging과 동일 checksum <!-- p0:deploy.production-checksum -->
