# MVP 범위

## P0 — 출시 필수

### 편집

- 문단, 제목 H2~H4
- 굵게, 기울임, 밑줄, 취소선
- 링크, 인용, 순서·비순서 목록
- 코드 블록, 구분선, 실행취소·다시실행
- 정렬, 표, 이미지 선택·드래그·클립보드 업로드
- placeholder, read-only, 높이 설정
- 단일 문자열과 G7 다국어 객체
- 한글 IME, 붙여넣기 정리, 키보드 접근성

### 정책

- `policy/editor-policy.json` 기반 client schema
- 서버 저장 sanitizer
- 출력 DOMPurify allowlist
- class token UI와 CSS
- 문서·이미지·표 크기 제한
- 위험 URL과 외부 이미지 정책

### G7 통합

- `html_editor`, `html_content` replace
- 기존 extension point props 호환
- 기존 이미지 업로드·serve·관리 기능 동등성
- 설정, 권한, 메뉴, 훅, 저장소 드라이버
- CKEditor 충돌 감지, 교체 전 명시적 위험 확인, 문서별 손실 재확인과 롤백 안내
- GitHub/ZIP 업데이트와 upgrade step

## P1 — 1.1 후보

- 검색·치환
- 콘텐츠 템플릿
- 사용자 역할별 toolbar/policy profile
- 미사용 이미지 참조 스캔 확장

## P2 — 별도 사업 결정

- 협업, 댓글, 버전 비교
- 문서 import/export
- AI 작성 기능
- Tiptap Pro 또는 별도 협업 서버
- legacy inline style 일괄 변환·자동 마이그레이션

## MVP 탈락 조건

- 서버 sanitizer 없이 브라우저 정제만 제공
- 기존 CKEditor HTML을 조용히 손실
- 이미지 관리 parity 누락
- 두 에디터 동시 활성화 경쟁
- CDN이 끊기면 편집·출력이 중단
- `style` 또는 임의 class를 저장
