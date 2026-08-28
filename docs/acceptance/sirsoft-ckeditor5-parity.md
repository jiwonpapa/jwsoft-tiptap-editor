# sirsoft-ckeditor5 완전 대체 동등성

이 문서의 `P0` 항목이 모두 자동화 증거와 함께 통과해야 stable을 출시할 수 있습니다. 단순 체크 표시가 아니라 `test-results/parity/evidence.json`의 성공 결과가 필요합니다.

현재 MVP 6차는 전용 G7 7.0.9에서 22개 MVP 계약의 실제 설치·DB·인증 브라우저 evidence와 재현 가능한 `alpha.7` ZIP을 생성합니다. 아래 전체 P0 체크리스트에는 실기기·공개 화면·staging 등 release 단계가 남아 있으므로 MVP evidence 통과를 stable 승인으로 해석하지 않습니다.

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
- [ ] 위험 URL·SVG·form·script·임의 iframe 차단
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

## D-1. 미디어 하위 시스템

- [ ] YouTube·Vimeo·MP4 URL provider allowlist
- [ ] 저장 HTML에 iframe·video·script 0
- [ ] 출력 player 클릭 후 로드·반응형·자동재생 opt-in
- [ ] provider 설정 OFF와 기존 media node 무손실
- [ ] MP4 청크 해시·재시도·재개·서버 재검증
- [ ] 중단 업로드 24시간 만료 정리와 완성 파일 serve

## E. G7 관리 기능

- [ ] imageUpload, imageMaxSizeMb, videoUpload, videoMaxSizeMb, videoChunkSizeMb, editorHeight, toolbar 설정
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
- [x] CKEditor 동시 활성화 차단
- [x] CKEditor → jwsoft 전환 smoke
- [x] jwsoft → CKEditor 롤백 smoke
- [x] legacy HTML 왕복과 손실 보고

## H. 공급망과 배포

- [x] CDN 요청 0
- [x] npm/composer lock과 audit 통과
- [x] reproducible build 또는 산출물 checksum 동일성
- [x] package manifest·vendor·dist 포함
- [ ] staging 배포와 smoke
- [ ] production은 staging과 동일 checksum
