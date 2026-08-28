# 호환성 기준

## 기준선

| 항목    |           환경 단계 기준 |                             stable 목표 |
| ------- | -----------------------: | --------------------------------------: |
| G7      |                    7.0.9 |               최신 stable + 직전 stable |
| PHP     |                  8.2~8.5 |                            G7 지원 범위 |
| Node    | 22.22.2+, 24.15.0+, 26.x |               최신 jsdom 호환 빌드 전용 |
| MySQL   |                     8.0+ |                                통합/E2E |
| MariaDB |                    10.3+ |                   최소 1회 release 검증 |
| Browser |            Chromium 최신 |          Chromium, Firefox, WebKit 최신 |
| Mobile  |       Chromium emulation | Android Chrome + iOS Safari 실기기 표본 |

## G7 화면

- 공개 게시판 작성·수정·답글·조회
- 관리자 게시글 작성·수정·조회
- 쇼핑몰 상품 설명 작성·수정·조회
- 페이지 작성·수정·조회
- 다국어 content
- CKEditor가 적용하지 않는 직접 HtmlEditor 화면의 fallback 무회귀

## 브라우저 동작

- 한글 조합 중 state sync로 글자 중복·유실 없음
- 모바일 키보드와 viewport에서 toolbar 접근 가능
- 키보드만으로 toolbar와 링크·표·이미지 대화상자 사용 가능
- 붙여넣기와 대용량 문서에서 화면 멈춤 기준 준수
- 불안정한 연결에서 MP4 청크 재시도·동일 탭 재개

## 성능 예산

MVP 5 전용 G7 7.0.9 Chromium 하네스의 초기 예산은 다음과 같이 고정합니다.

- editor JS gzip 500KiB 이하
- 인증 G7 route 이동부터 단일 editor 준비까지 p95 2,500ms 이하
- 화면별 활성 editor instance 1개
- 100KB HTML load p95 1초 이하
- 1MB 정책 상한 문서가 브라우저를 중단시키지 않음

MVP 5 측정값은 gzip 162,061 bytes, route-to-editor p95 1,227ms, 최대 동시 instance 1개입니다. 100KB/1MB 문서와 장시간 메모리 누수 예산은 release 단계에서 별도로 측정합니다.
