# ADR 0010 — 공개 GitHub 설치 원본

- 상태: Accepted
- 날짜: 2026-08-29
- 적용 버전: 0.1.0-alpha.11
- 승인: 제품 소유자 공개 전환 지시

## 배경

G7의 `GitHub에서 설치` 기능은 GitHub Release 첨부 ZIP이 아니라 최신 릴리스의 source archive를 우선 사용하고, 릴리스가 없으면 `main` source archive로 폴백합니다. 개발 소스만 공개하면 `dist/js/plugin.iife.js`와 PHP vendor bundle이 빠져 설치 후 편집기가 실행되지 않을 수 있습니다.

기존 ADR-0006은 공개 저장소 전환에 별도 라이선스 결정과 제품 소유자 승인을 요구했습니다. 2026-08-29 제품 소유자가 GitHub public 전환과 온라인 설치 제공을 명시적으로 승인했습니다.

## 결정

- `https://github.com/jiwonpapa/jwsoft-tiptap-editor`를 public으로 전환합니다.
- 제품 라이선스는 Proprietary를 유지합니다. 공개 열람은 오픈소스 허가나 사용·복제·배포 권한 부여가 아닙니다.
- NPM 레지스트리 게시를 막기 위해 `private: true`, `UNLICENSED`를 유지합니다.
- 공개 `main` source archive에 빌드된 `dist/js/plugin.iife.js`, `vendor-bundle.zip`, `vendor-bundle.json`을 포함합니다.
- `make package`가 GitHub 설치용 vendor bundle을 릴리스 ZIP과 같은 입력에서 동기화하고 checksum을 검증합니다.
- alpha 온라인 설치는 개발·staging 전용이며 stable 또는 운영 설치 승인으로 표현하지 않습니다.

## 결과

G7 관리자는 공개 GitHub URL만으로 alpha 플러그인을 내려받아 설치할 수 있습니다. Node나 Composer가 없는 대상에서도 bundled vendor 모드를 사용할 수 있습니다. 공개 저장소에 비밀·운영 환경 파일·인증서·개인정보를 포함하지 않는 기존 공급망 규칙은 그대로 유지합니다.
