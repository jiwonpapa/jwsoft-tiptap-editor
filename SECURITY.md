# Security Policy

현재 저장소는 비공개 개발 단계입니다. 보안 문제는 저장소 소유자에게 비공개로 보고하고, 공개 이슈에 공격 payload·운영 주소·인증 정보를 남기지 않습니다.

## 지원 범위

- `main`: 개발 중, 지원
- stable 최신 minor: 출시 후 지원
- 과거 minor: 보안 영향에 따라 별도 공지

## 필수 대응

- 재현 fixture와 영향 범위를 비공개로 보존합니다.
- 서버 저장 sanitizer 우회는 최고 우선순위로 처리합니다.
- 수정 전후 XSS corpus와 legacy round-trip을 실행합니다.
- 보안 릴리스는 checksum과 변경 이력을 제공합니다.
