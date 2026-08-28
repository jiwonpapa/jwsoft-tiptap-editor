# 제품 기획서

## 한 줄 정의

`jwsoft-tiptap-editor`는 그누보드7의 기존 CKEditor 플러그인을 코어 수정 없이 대체하고, class token 화이트리스트와 서버 저장 검증을 기본 제공하는 독립 에디터 제품입니다.

## 해결할 문제

- 기본 HtmlEditor는 textarea와 미리보기 수준입니다.
- 기존 `sirsoft-ckeditor5`는 편집 기능은 풍부하지만 CDN·라이선스·버전 관리가 외부 정책에 묶입니다.
- 현재 CKEditor GHS 설정은 모든 태그·속성·클래스·스타일을 허용합니다.
- 현재 출력 sanitizer는 allowlist가 아니라 차단 목록 중심입니다.
- 편집기, 저장 API와 출력 renderer의 정책 SSoT가 없습니다.

## 목표 사용자

- G7 게시판·쇼핑몰·페이지 운영자
- 임의 HTML/CSS 없이 일관된 콘텐츠 디자인을 원하는 구축사
- 자체 호스팅·보안 업데이트·롤백 가능한 편집기가 필요한 서비스

## 제품 가치

1. 설치·활성화만으로 공식 extension point 영역을 교체합니다.
2. 인라인 스타일 대신 템플릿과 합의된 class token을 사용합니다.
3. 서버 저장 시점에 동일 정책으로 정규화합니다.
4. 기존 HTML 데이터와 검색·SEO 계약을 유지합니다.
5. 독립 버전, GitHub release, checksum, G7 update 명령으로 배포합니다.

## 성공 지표

- G7 코어 변경 파일 0
- 외부 런타임 CDN 요청 0
- `sirsoft-ckeditor5` 필수 parity 항목 통과율 100%
- XSS 보안 corpus 우회 0
- 미등록 class와 `style` 저장 0
- legacy 허용 HTML 무통보 손실 0
- staging 설치·업데이트·롤백 자동 검증 성공

## 비목표

- Google Docs급 실시간 협업
- Tiptap Pro 기능의 무조건적 포함
- G7 모든 직접 `HtmlEditor` 사용 화면을 코어 수정으로 강제 교체
- 임의 HTML·CSS·JavaScript 실행 환경
- 첫 MVP에서 Tiptap JSON을 DB 정본으로 전환
