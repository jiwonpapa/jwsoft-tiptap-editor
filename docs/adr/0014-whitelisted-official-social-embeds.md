# ADR-0014: 화이트리스트 기반 공식 SNS 게시물 표시

- 상태: Accepted (2026-08-31 형님 승인: 외부 삽입은 화이트리스트)
- 적용 버전: 0.1.0-rc.4 / 정책 1.6.0
- 대체 범위: ADR-0009의 X·Facebook 메타데이터 전용 표시 제한 및 제6조의 해당 공식 SDK 예외

## 결정

X와 Facebook의 허용된 게시물 URL만 공식 SDK로 표시한다. 코드·라이브러리·폰트는
계속 패키지에 포함하며, 임의 CDN·사용자 HTML·사용자 지정 iframe/script는 허용하지 않는다.
URL 호스트·게시물 경로·정규화·고정 SDK URL·초기 실행 문서의 CSP는
`policy/editor-policy.json.externalEmbeds`를 단일 출처로 사용한다.

X는 공식 `widgets.createTweet`으로 본문·사진·영상을 표시한다. Facebook은
공식 `FB.XFBML.parse`의 공개 게시물 표시를 사용한다. SNS의 HTML을 서버에서
수집해 원문처럼 저장하지 않는다. 게시물이 비공개·삭제·지역/연령/로그인 제한이면
제공자가 거부할 수 있으며, 게시물이 반드시 표시된다고 보장하지 않는다.

SDK는 표시 전용 하위 프레임에서만 로드한다. 이는 UI/수명주기 분리이며 보안 sandbox가
아니다. opaque-origin sandbox는 실제 시험에서 X CORS와 Facebook document.domain
제약으로 작동하지 않았다. same-origin 외부 코드의 실행 권한을 신뢰하는 명시적 예외다.
공식 SDK도 공급망 침해 시 부모 페이지에 접근할 수 있으므로 일반 CDN 허용으로 확대하지 않는다.

## 저장·서버 경계

- 기존 `figure.jw-card > a.jw-card-link` canonical HTML과 정제 정책을 유지한다.
- 서버 미리보기는 허용 URL에 대해서만 표시 descriptor를 생성한다. descriptor 제목은
  제공자 이름이며 가져온 게시물 본문이나 조회 성공으로 해석하지 않는다.
- HTML 정제기는 iframe/script/style/on*/임의 data-*를 계속 제거한다.
- SDK 응답·실행 DOM·포스트 높이·클릭 상태는 저장하지 않는다.
- 이외 사이트는 기존 SSRF 방어 링크 메타데이터 경로만 사용한다. 새 SDK를 자동 추가하지 않는다.
- 기존 글을 일괄 변경하거나 재저장하지 않는다. OFF 또는 미지원 URL은 기존 카드로 표시한다.

## 설정과 개인정보

`smartCards`와 `socialCards`가 켜져 있어야 한다. 그 아래 `xEmbed`, `facebookEmbed`
두 토글로 제공자별 연결을 제한한다. 두 토글 기본값은 true이나 master는 기존 false를
유지한다. 기존 master ON 사이트에서 업그레이드 후 공식 표시가 켜진다는 변경을 알린다.
편집/글보기 모두 `externalMediaLoadMode`를 따르며 click 모드는 클릭 전 SDK 요청이 없다.

표시를 요청하면 제공자는 방문자의 IP·브라우저·referrer 및 제공자 쿠키를 처리할 수 있다.
G7 인증 토큰이나 폼 본문을 SDK 인자로 전달하지 않는다. CSP는 초기 실행 문서를
제공자별 고정 origin으로 제한하지만, 교차 출처 자식 프레임 내부의 모든 네트워크를
통제한다는 의미는 아니다. 사이트 CSP도 이 공식 연결을 허용해야 한다.

## UX와 실패 처리

편집/글보기에서 동일 표시기를 사용한다. 실제 SDK 표시 완료·높이 알림을 받은 뒤
표시 영역을 확장한다. iframe load 이벤트만으로 게시물 성공을 판정하지 않는다.
원문 링크는 항상 유지하고 20초 내 표시되지 않으면 빈 거대 상자 대신 재시도/원문을
제공한다. Facebook의 자체 오류 화면은 교차 출처 때문에 일반 게시물과 구분할 수 없어
제공자 화면임을 알린다. 이를 본문 수집 성공으로 보고하지 않는다.
최소 제공자 폭보다 작은 화면은 프레임을 비율 축소하며 긴 게시물은 내부 스크롤한다.
삭제·페이지 이동·설정 OFF 시 프레임과 이벤트/타이머를 해제한다.

## 검증 기준

정규 URL·위장 호스트·userinfo·포트·퍼센트 경로·스크립트 입력·설정 OFF를 단위 검증한다.
서버 descriptor와 클라이언트 canonical URL 동등성, 정제 왕복과 기존 SSRF 검사를 유지한다.
브라우저에서는 편집/조회 동일 SDK·CSP, URL 삽입, 재편집·삭제·원문·재시도·설정 OFF·
click 전 네트워크 없음·가로 넘침을 검증한다. 네트워크 모의 검사와 실제 제공자 표시는
별도 증거로 기록한다. 실제 제공자 표시 실패를 모의 테스트 통과로 대체하지 않는다.

## 공식 자료

- [X JavaScript factory](https://docs.x.com/x-for-websites/embedded-posts/guides/embedded-post-javascript-factory-function)
- [X embedded posts](https://docs.x.com/x-for-websites/embedded-posts/overview)
- [Facebook embedded posts](https://developers.facebook.com/docs/plugins/embedded-posts/)

Meta 문서 조회가 429를 반환했으므로 SDK v23.0 동작은 실제 브라우저 검증을 별도로 요구한다.

## 2026-09-02 사진 주소 누락 보완 (정책 1.6.1)

소유자가 제보한 Facebook 사진 및 일반 주소 누락을 수정한다. 기존 Facebook 호스트
안에서 `/photo`, `/photo/`, `/photo.php`의 단일 숫자 `fbid`, `permalink.php`와
`story.php`의 `story_fbid`/`id`, Watch의 `v`, Reel의 숫자 ID를 추가로 허용한다.
식별자는 보존하고 앨범·locale·추적 파라미터는 SDK에 전달하지 않는다. 중복 ID,
배열형 ID, 잘못된 숫자, 위장 호스트·포트·경로는 실행 대상에서 제외한다.

`/share/p|v|r/토큰` 및 `fb.watch/토큰`은 실행 URL이 아니다. 서버가 해당 고정
Facebook 호스트의 공개 IP를 DNS 검증·연결 고정한 HEAD 요청으로만 따라가고, 기존
리디렉션 횟수/시간 제한 안에서 최종 허용 게시물 경로가 확인되면 정규화한다.
외부 사이트·사설 IP·로그인 화면·확인 불가 주소로 넘어가면 중단한다. SDK에 공유
wrapper를 그대로 전달하거나 페이지 HTML을 수집해 게시물로 위조하지 않는다.
기존 SDK·CSP·설정·canonical HTML 구조와 실행 호스트는 늘리지 않는다. 서버의
주소 확인에만 `fb.watch`를 허용하며 임의 iframe이나 기존 글 일괄 변경은 없다.

링크 미리보기의 `throttle:10,1`은 사용자 단위 카운터가 일반 G7 요청과 충돌하므로
`jwsoft-link-preview:` 접두사로 분리한다. 10회/분 제한을 늘리거나 끄지 않는다.

TS/PHP 공통 fixture로 정규화 동등성을 검사하고, 실제 공개 사진의 편집·조회·재편집
표시 및 모바일 넘침을 별도로 확인한다. URL 인식 통과를 제공자 표시 성공으로
대체하지 않는다.
