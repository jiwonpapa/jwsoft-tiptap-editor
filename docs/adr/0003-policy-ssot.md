# ADR-0003: editor policy 단일 원본

- 상태: 승인
- 날짜: 2026-08-28

## 결정

`policy/editor-policy.json`을 허용 HTML과 class token의 SSoT로 사용하고 client/server/CSS/test 파생물을 생성합니다.

## 이유

편집기에서는 허용하지만 서버가 제거하거나, 출력단이 다시 허용하는 정책 drift를 차단합니다.

## 결과

policy 변경은 version, migration 영향, fixture와 CHANGELOG를 요구합니다.
