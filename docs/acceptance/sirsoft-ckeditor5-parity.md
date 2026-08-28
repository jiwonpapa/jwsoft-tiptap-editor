# sirsoft-ckeditor5 완전 대체 동등성

이 문서의 `P0` 항목이 모두 자동화 증거와 함께 통과해야 stable을 출시할 수 있습니다. 단순 체크 표시가 아니라 `test-results/parity/evidence.json`의 성공 결과가 필요합니다.

현재 MVP 3차는 기본 툴바와 class-token 서식, 링크·표·URL 이미지, 붙여넣기 정제까지 구현했습니다. 아래 체크는 실제 설치·DB·브라우저 parity evidence가 생성될 때만 완료 처리합니다.

## A. 편집기 교체

- [ ] `html_editor` replace extension 제공
- [ ] `html_content` replace extension 제공
- [ ] content/value/name/placeholder/readOnly/disabled/height 호환
- [ ] 단일 문자열·다국어 map 호환
- [ ] mount/unmount와 화면 이동 시 instance 누수 없음
- [ ] G7 state sync debounce와 최신 상태 재조회

## B. 편집 기능

- [ ] minimal/standard/full toolbar profile
- [ ] 제목, 문단, bold, italic, underline, strike
- [ ] 링크, 인용, 목록, 정렬, 들여쓰기 동등 동작
- [ ] 표 생성·편집
- [ ] 이미지 업로드·caption·정렬·크기
- [ ] code block, source 정책, horizontal rule
- [ ] undo/redo, 붙여넣기, 한글 IME

## C. 정책과 보안

- [ ] 서버 sanitizer가 모든 저장 endpoint에 적용
- [ ] `style`, 이벤트 속성, 미등록 class 저장 0
- [ ] 위험 URL·SVG·form·script·iframe 차단
- [ ] DOMPurify 최신 allowlist 출력
- [ ] security corpus 전체 통과
- [ ] 정책 오류 시 fail closed

## D. 이미지 하위 시스템

- [ ] 업로드 인증·권한·크기·MIME 검증
- [ ] StorageInterface 사용
- [ ] 이미지 serve route와 cache header
- [ ] 업로드 레코드와 참조 상태
- [ ] 관리자 목록·단건·일괄 삭제
- [ ] 미사용 이미지 cleanup opt-in과 retention
- [ ] before/after/filter/reference source 훅 동등성 또는 명시적 호환 alias
- [ ] 외부 이미지/업로드 실패/고아 파일 처리

## E. G7 관리 기능

- [ ] imageUpload, imageMaxSizeMb, editorHeight, toolbar 설정
- [ ] public asset disk 설정
- [ ] cleanup 설정
- [ ] 관리자 메뉴와 read/delete 권한
- [ ] 활동 로그·오류 로그에 비밀·본문 원문 노출 없음

## F. 대상 화면

- [ ] 공개 게시판 create/edit/reply/show
- [ ] 관리자 게시판 create/edit/show
- [ ] 쇼핑몰 상품 description create/edit/show
- [ ] 페이지 create/edit/show
- [ ] 모바일·다크모드·다국어
- [ ] direct HtmlEditor fallback 화면 무회귀

## G. 수명주기

- [ ] source 설치, ZIP 최초 설치
- [ ] ZIP/GitHub update와 upgrade step
- [ ] activate/deactivate/uninstall
- [ ] CKEditor 동시 활성화 차단
- [ ] CKEditor → jwsoft 전환 smoke
- [ ] jwsoft → CKEditor 롤백 smoke
- [ ] legacy HTML 왕복과 손실 보고

## H. 공급망과 배포

- [ ] CDN 요청 0
- [ ] npm/composer lock과 audit 통과
- [ ] reproducible build 또는 산출물 checksum 동일성
- [ ] package manifest·vendor·dist 포함
- [ ] staging 배포와 smoke
- [ ] production은 staging과 동일 checksum
