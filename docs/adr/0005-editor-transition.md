# ADR-0005: replace editor 전환과 롤백

- 상태: 승인
- 날짜: 2026-08-28

## 결정

`sirsoft-ckeditor5`와 `jwsoft-tiptap-editor`는 설치 상태로 공존할 수 있지만 동시에 활성화할 수 없습니다. 관리자 활성화 경로는 `core.plugins.before_activate`에서 차단하고, G7 7.0.9 CLI 우회 경로는 `core.plugins.activated`에서 CKEditor를 즉시 비활성화한 뒤 명령을 실패 처리합니다. guard는 JWSoft가 실제 활성 상태일 때만 동작합니다.

## 이유

두 replace extension이 같은 `html_editor` 지점을 경쟁하면 저장 state와 화면 instance의 정본이 불명확해집니다. G7 코어를 수정하지 않으면서 관리자와 CLI 경로의 최종 상태를 동일하게 유지해야 합니다.

## 결과

전환 순서는 CKEditor 비활성화 → JWSoft 활성화 → smoke이며, 롤백은 역순입니다. 저장 정본은 canonical HTML이므로 DB 형식 변환은 하지 않습니다. lifecycle evidence는 페이지·게시글·상품 HTML 해시와 이미지 레코드 수가 업데이트·롤백·복구 전후 동일한지 검사합니다.
