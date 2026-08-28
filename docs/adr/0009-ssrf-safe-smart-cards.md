# ADR 0009 — SSRF 방어형 링크 스마트카드

- 상태: Accepted
- 날짜: 2026-08-28
- 적용 버전: 0.1.0-alpha.10

## 배경

SNS와 일반 URL을 자동 카드로 만들려면 서버가 외부 페이지 metadata를 읽어야 합니다. 사용자가 목적지를 정하는 서버 요청은 사설망 접근, DNS rebinding, redirect 우회, 과대 응답과 지연 공격 위험이 있습니다. 공급자 script나 임의 embed HTML을 저장하면 기존 canonical HTML 정책도 무너집니다.

## 결정

- `smartCards`와 자동 붙여넣기 변환은 기본 꺼짐으로 둡니다. SNS·일반 링크·대표 이미지도 별도 설정합니다.
- HTTPS 443 URL만 받고 사용자정보·제어문자·비표준 포트를 거부합니다.
- 모든 A/AAAA 응답이 공개 IP인지 검사한 뒤 선택한 주소를 `CURLOPT_RESOLVE`로 고정합니다. 최대 3회 redirect도 목적지를 다시 검증합니다.
- HTML 응답만 최대 512KB까지 스트림으로 읽으며 연결 3초·전체 6초 timeout과 분당 10회 throttle을 적용합니다.
- Open Graph title·description·선택적 image만 추출하고 text 길이를 제한합니다. 대표 이미지는 최종 페이지와 같은 공개 호스트만 허용합니다.
- Instagram·X·TikTok·Facebook·Threads가 metadata 요청을 거부하면 외부 script를 우회 로드하지 않고 provider 이름과 원 URL만 가진 카드로 폴백합니다.
- 저장 정본은 allowlist class를 가진 `figure > a > img?/strong/p?`이며 script·iframe·임의 `data-*`를 저장하지 않습니다.

## 결과

공급자 SDK·API key·외부 런타임 script 없이 링크 카드를 제공합니다. 로그인 뒤에만 보이는 SNS 본문이나 JavaScript 렌더링 콘텐츠는 제목·설명 없이 provider 카드로 표시될 수 있습니다. 이 제한은 보안 경계를 완화하지 않고 명시적으로 유지합니다.
