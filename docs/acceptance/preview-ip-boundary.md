# 링크 미리보기 공개 IP 경계

0.1.5는 일반 링크의 메타데이터를 가져오는 서버 요청의 주소 검증을 보완합니다.
방문자 IP 수집이나 SNS 플레이어 변경이 아닙니다. 기존 HTTPS·443·TLS 검증,
요청 제한·리다이렉트 수 제한·연결 IP 고정은 유지합니다.

## 구현

`DnsSafeUrlResolver`는 PHP 8.2부터 제공되는 `FILTER_FLAG_GLOBAL_RANGE`로
공개 주소를 판정합니다. 사설·예약 주소만 제외하는 판정으로 되돌리지 않습니다.
HTTP 목적지에서는 IPv4 multicast를 제외하고 IPv6는 native global unicast
`2000::/3` 안에서만 허용합니다. mapped/NAT64 변환 주소는 외부처럼 보이는
주소가 내부 IPv4 목적지를 숨길 수 있어 거부합니다. IPv6 특수용도 제외는
PHP의 global-range 판정도 함께 통과해야 합니다.

한 호스트의 A/AAAA 응답에 차단 주소가 하나라도 섞이면 전체를 거부합니다.
첫 공개 응답만 선택하고 나머지 결과를 무시하지 않습니다. 후속 리다이렉트도
다시 검증하며, 허용한 IP를 실제 연결에 고정합니다. 임의 요청 HTML은 실행하지
않고, 요청 실패 시 기존 URL과 오류 안내를 유지합니다.

## 검증

- `make check`: `tests/php/dns_safe_url_resolver_test.php`의 실제 resolver를
  사용한 주소 경계·정상 공개 주소·혼합 A/AAAA·빈 DNS·잘못된 호스트 회귀.
  PHP namespaced DNS fixture로 외부 네트워크 요청 없이 실행합니다.
- `make integration-check`: 실제 G7 HTTP client와 resolver 조합에서 차단
  주소로 HTTP 요청 0회, 리다이렉트 재검증, 공개 IP 고정·정상 카드 생성을 검증합니다.
  HTTP 응답은 모의값이며 실제 내부망 접근이나 외부 게시물 표시 성공의 증거가 아닙니다.
- resolver를 기존 PHPStan 독립 분석 범위에도 포함합니다.
- 기존 출시 기준 `cards.ssrf`와 전체 62개는 유지합니다. 새 버전의 설치·화면·배포
  완료는 해당 버전의 실행 증거를 별도로 요구합니다.

근거: [PHP 8.2 추가 상수](https://www.php.net/manual/en/migration82.constants.php),
[IANA IPv4 특수 주소](https://www.iana.org/assignments/iana-ipv4-special-registry/),
[IANA IPv6 global unicast](https://www.iana.org/assignments/ipv6-unicast-address-assignments/).
