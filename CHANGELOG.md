# Changelog

모든 주요 변경은 이 파일에 기록합니다. 형식은 Keep a Changelog와 Semantic Versioning을 따릅니다.

## [Unreleased]

### Added

- 독립 GitHub 저장소와 로컬 개발 환경
- 제품 헌법, MVP 기획, 아키텍처, 보안, 설치, 테스트, 배포 문서
- manifest·policy·문서·빌드 검증 하네스
- CKEditor 완전 대체 parity gate와 배포 fail-closed 골격
- G7 `html_editor`·`html_content` replace extension과 Tiptap lifecycle adapter
- 단일·다국어 content, read-only·disabled·height, G7 debounce state sync 계약
- CKEditor 동시 활성화 서버·브라우저 이중 차단과 adapter 단계 read-only gate
- `editor-policy.json`에서 TypeScript·PHP·DOMPurify·token CSS를 생성하는 checksum codegen
- Symfony 기반 canonical HTML sanitizer와 G7 7.0.9 게시판 사용자·관리자 저장 미들웨어
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
