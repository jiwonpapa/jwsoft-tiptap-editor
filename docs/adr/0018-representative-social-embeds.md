# ADR-0018: 대표 SNS 오픈소스 정규화와 공식 표시

- 상태: Accepted (2026-09-04 형님 승인: 대표 SNS만 오픈소스로 지원)
- 적용 버전: 0.1.3 / 정책 1.7.0
- 관련 결정: ADR-0014, 헌법 제4조·제6조

## 결정

정식 자동 삽입 범위를 YouTube, Vimeo, X, Facebook, Instagram, TikTok 여섯
제공자로 제한한다. 이외 SNS는 일반 HTTPS 링크 카드로 처리한다.

브라우저의 주소 판별과 추적 파라미터 제거에는 MIT `social-media-parser`를 고정 버전으로
번들한다. YouTube와 Vimeo는 기존 미디어 플레이어를, X와 Facebook은 기존 공식 SDK
표시기를 유지한다. Instagram과 TikTok은 공식 SDK를 ADR-0014와 동일한 일회용 표시
프레임에서만 실행한다. 유료 API, 별도 Node 서비스, 런타임 범용 CDN 라이브러리는 쓰지 않는다.
TikTok 공식 `embed.js`의 현재 HTTPS 리다이렉트 대상인
`sf16-website-login.neutral.ttwstatic.com`만 스크립트 CSP에 추가하며 와일드카드는 쓰지 않는다.

`hyvor/unfold`는 최신판이 PHP 8.4를 요구하고 PHP 8.2용 버전은 임의 style·script·iframe
HTML을 반환하므로 도입하지 않는다. 제공자 HTML을 저장하거나 그대로 실행하지 않는다.

## 입력과 저장 경계

- URL 또는 여섯 제공자의 공식 퍼가기 코드를 받을 수 있다.
- 퍼가기 코드는 브라우저 `DOMParser`로 실행 없이 읽고, 오픈소스 파서가 인정한 HTTPS
  원본 URL만 추출한다. 입력 iframe·script·style·data 속성은 저장하지 않는다.
- 서버는 `policy/editor-policy.json.externalEmbeds`의 호스트·경로·식별자를 다시 검증한다.
- 저장 정본은 기존 `figure.jw-card > a.jw-card-link` 또는 미디어 canonical HTML이다.
- 비공개·삭제·로그인·지역·연령 제한 및 제공자 차단은 원문 링크와 재시도 상태로 끝낸다.

## 설정과 신뢰 경계

`smartCards`, `socialCards` 아래의 `xEmbed`, `facebookEmbed`, `instagramEmbed`,
`tiktokEmbed` 토글로 제공자별 외부 연결을 제어한다. 네 토글의 기본값은 true지만
`smartCards` 기본값은 false를 유지한다. 편집 화면과 글보기는 같은 표시기와
`externalMediaLoadMode`를 사용한다.

외부 SDK는 방문자의 IP, 브라우저 정보, referrer와 제공자 쿠키를 처리할 수 있다.
고정 CSP는 초기 문서의 연결 범위를 줄이지만 공식 SDK 자체를 신뢰하지 않는 보안
sandbox는 아니다. 이 예외는 새 SNS나 사용자 제공 실행 HTML로 자동 확대하지 않는다.

## 검증

- 대표 URL 변형·공식 퍼가기 코드·추적 파라미터·위장 호스트·스크립트 단독 입력
- TypeScript와 PHP의 canonical URL 동등성 및 제공자별 설정 OFF
- 편집/글보기 동일 렌더링, click 전 외부 요청 0, 실패 fallback, 모바일 가로 넘침 0
- 저장 HTML의 iframe·script·style·임의 data 속성 0
- lockfile, MIT 라이선스 원문, dependency audit와 릴리스 ZIP 포함
