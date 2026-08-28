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
