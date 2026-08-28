# ADR 0007 — 안전한 외부 미디어 노드

## 상태

승인됨 — 2026-08-28, 형님이 설정 가능한 전체 미디어 기능 구현을 명시적으로 승인했습니다.

## 배경

YouTube·Vimeo·MP4 URL을 붙여넣거나 선택해 반응형 플레이어를 삽입해야 합니다. 임의 iframe·script·style·data 속성을 저장하면 현재 최소권한 HTML과 자체 호스팅 원칙을 깨뜨립니다.

## 결정

- DB에는 제공자별 class token과 정규 URL을 가진 canonical `figure > a`만 저장합니다.
- iframe과 video는 저장 HTML에서 계속 금지합니다.
- 자체 번들 renderer가 허용된 URL을 다시 검증한 뒤 출력 DOM에만 iframe 또는 video를 생성합니다.
- 외부 플레이어는 기본적으로 클릭 후 로드하며 자동재생은 기본 꺼짐입니다.
- YouTube는 `youtube-nocookie.com`, Vimeo는 `player.vimeo.com`, MP4는 HTTPS 또는 플러그인 공개 경로만 사용합니다.
- 설정을 끄면 새 삽입을 막고 기존 canonical HTML을 삭제하거나 재작성하지 않습니다.

## 보안 영향

- 사용자가 붙여넣은 embed HTML과 provider script는 저장하지 않습니다.
- renderer는 provider ID와 URL 형식을 완전 일치로 검사하고 고정된 iframe 속성만 생성합니다.
- CSP의 `frame-src`와 운영 개인정보 고지는 실제 활성 provider에 맞춰 별도 설정해야 합니다.
- 서버 sanitizer가 미등록 class와 URL을 계속 제거하며 클라이언트 변환만으로 저장을 승인하지 않습니다.

## 호환성과 마이그레이션

- 정책 버전을 `1.1.0`, 제품 버전을 `0.1.0-alpha.8`로 올립니다.
- 기존 HTML의 일괄 변환은 하지 않습니다.
- 새 미디어 노드를 지원하지 않는 이전 버전에서는 안전한 링크로 남습니다.

## 검증

- provider URL 정규화 단위 테스트
- 임의 iframe·script 저장 차단 PHP corpus
- canonical media node 왕복 테스트
- editor·preview·public 반응형 브라우저 테스트
