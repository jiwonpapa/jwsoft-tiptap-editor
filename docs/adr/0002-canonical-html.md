# ADR-0002: canonical HTML 저장

- 상태: 승인
- 날짜: 2026-08-28

## 결정

기존 G7 content 컬럼에 서버 정제 HTML을 저장합니다. Tiptap JSON은 편집 내부 상태로만 사용합니다.

## 이유

게시판·상품·페이지·검색·SEO·API와 기존 콘텐츠를 코어 수정 없이 유지합니다.

## 결과

정교한 editor round-trip을 위해 HTML parser와 loss report가 필요합니다. JSON 정본 도입은 별도 migration ADR 대상입니다.
