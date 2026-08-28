# 릴리스 체크리스트

## 코드

- [ ] 헌법 위반 없음
- [ ] CHANGELOG와 버전 동기화
- [ ] G7 최소 버전 근거
- [ ] 공개 API·훅·설정 문서

## 품질

- [ ] `make release-check`
- [ ] npm/composer audit
- [ ] parity evidence 100%
- [ ] legacy loss report 검증
- [ ] staging install/update/rollback

GitHub `Release gate`는 `self-hosted`, `linux`, `g7-integration` 라벨을 가진 격리 러너에서만 실행합니다. 저장소 변수 `G7_INTEGRATION_ROOT`와 `G7_INTEGRATION_URL`을 설정하고, 테스트가 같은 실행 안에서 parity evidence를 생성해야 합니다. 일반 CI 결과만으로 릴리스하지 않습니다.

## 패키지

- [ ] dist, vendor, manifest, resources 포함
- [ ] 개발 fixture·비밀·node_modules 제외
- [ ] SHA256SUMS
- [ ] ZIP 재설치 검증

## 공개

- [ ] 제품 라이선스 결정
- [ ] Tiptap·ProseMirror·DOMPurify·Symfony NOTICE
- [ ] GitHub visibility 승인
- [ ] 태그·GitHub release·설치 문서
