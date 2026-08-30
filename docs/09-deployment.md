# 배포 하네스

## 원칙

- `--plan`이 기본이며 서버를 변경하지 않습니다.
- `--apply`가 없으면 변경하지 않습니다.
- production은 `PRODUCTION_APPROVAL=jwsoft-tiptap-editor-production`이 추가로 필요합니다.
- install/update 모드를 추측하지 않습니다.
- 원격 `APP_ENV`가 `EXPECTED_APP_ENV`와 다르면 변경 전에 중단합니다.
- 배포 역할(staging/production)은 승인된 대상 환경 파일로 결정합니다. Laravel `APP_ENV`는 실행 모드이며 스테이징도 production 모드를 사용할 수 있습니다. 이 경우 `EXPECTED_APP_ENV=production`을 명시해야 하며 디버그는 꺼져 있어야 합니다.
- production은 원격 `APP_ENV=production`, `APP_DEBUG=false`가 아니면 중단합니다.
- Laravel cache·view·log·bootstrap cache 및 기존 JWSoft 설치 경로의 파일·하위 디렉터리와 plugin 루트가 배포 사용자에게 쓰기 가능하지 않으면 업로드 전에 중단합니다.
- JWSoft 설치 여부와 `DEPLOY_MODE=install|update`가 일치하지 않으면 추측하거나 덮어쓰지 않습니다.
- SSH 사용자와 앱 소유자가 다르면 `DEPLOY_RUN_USER`를 명시합니다. 사전검증과 플러그인 명령은 `sudo -n -u`로 해당 계정에서 실행하며 소유권을 임의 변경하지 않습니다.
- 기존 JWSoft pending 경로는 삭제·덮어쓰지 않습니다. 최초 설치는 새 임시 디렉터리에 압축을 풀고 정확한 플러그인 루트를 이동합니다.
- staging에 사용한 artifact checksum만 production에 허용합니다.
- CKEditor 비활성화가 실패해 실제 활성 상태가 남아 있으면 JWSoft 활성화 guard가 배포를 중단합니다.
- `--apply`로 승인된 배포만 CKEditor 비활성화 → JWSoft 활성화를 수행합니다. 선행 위험 확인 설정은 요구하지 않으며 전환 직전에 안내합니다. 설치·활성화·조회는 기존 본문을 쓰지 않고, 기존 글 수정 후 저장 시에만 정제 HTML이 저장됩니다.

## 환경 파일

```bash
cp deploy/environments/staging.env.example deploy/environments/staging.env
```

실제 `.env` 파일은 gitignore 대상입니다.

이전 alpha.18에서 전환 위험 확인 설정 때문에 설치만 완료된 대상은 `DEPLOY_MODE=update`로 적용합니다. 새 버전은 접근할 수 없는 비활성 플러그인 설정을 활성화 조건으로 요구하지 않습니다. 관리자에서 직접 활성화할 때는 기존 에디터를 자동으로 비활성화하지 않습니다.

## 계획 확인

```bash
make deploy-plan ENV=staging
```

## 적용

```bash
make deploy ENV=staging APPLY=1
```

production:

```bash
PRODUCTION_APPROVAL=jwsoft-tiptap-editor-production \
  make deploy ENV=production APPLY=1
```

## 원격 순서

1. 로컬 release-check와 artifact·vendor bundle checksum
2. 원격 환경·권한·설치 모드 무변경 사전검증
3. artifact upload
4. remote checksum 검증 후 rollback trap 활성화
5. install 또는 update
6. 기존 글 수정 후 저장 시의 서식 변경 가능성과 에디터 전환 순서 안내
7. CKEditor 비활성화
8. jwsoft 활성화
9. cache clear
10. smoke와 배포 증거 기록

하네스는 DB 전체 백업을 자동으로 만들지 않습니다. 이 플러그인은 기존 HTML 필드를 유지하며 G7 plugin update의 파일 백업·복원을 사용합니다. 적용 실패 시 하네스는 jwsoft를 비활성화하고 CKEditor 재활성화를 시도합니다. DB migration이 추가되는 릴리스는 별도 migration/backup ADR과 운영 승인 없이는 배포할 수 없습니다.

staging smoke가 통과하면 `test-results/deploy/staging.json`에 artifact checksum과 대상·smoke URL의 SHA-256 지문만 기록합니다. production 계획·적용은 이 staging 증거와 `APPROVED_STAGING_SHA256`가 현재 artifact에 모두 일치해야 하며, 성공 후 `production.json`을 기록합니다. 원격 호스트·경로·URL 원문과 비밀값은 증거에 저장하지 않습니다.

`alpha.18`은 전용 로컬 G7에서 공개 GitHub 최초 설치, `alpha.16 → alpha.18` 업데이트, uninstall, CKEditor rollback, JWSoft restore와 콘텐츠 해시 보존을 검증한 공개 개발 릴리스입니다.

2026-08-30 alpha.18 최초 설치 시점에는 승인된 원격 staging G7 7.0.9에 공개 ZIP과 동일 checksum으로 설치했습니다. 원격 entrypoint·manifest·JS·vendor bundle checksum, 필수 테이블 3개, health·관리자 shell HTTP 200, 기존 본문 70,011건의 해시 및 코어 변경 상태 보존을 확인했습니다. 당시 선행 확인 설정이 false여서 JWSoft inactive, CKEditor active로 보류했습니다. 이 과거 설치 결과는 로컬 `test-results/deploy/staging-install.json`에 별도 기록하며 활성 editor smoke나 production 배포 증거가 아닙니다.

## alpha.19 활성화 UX 개선 검증 — 2026-08-30

- 구현 커밋 `7997b80`, 공개 태그 `v0.1.0-alpha.19`. CI 성공, 77개 단위 검사, G7 통합 검사, 2회 재현 패키지·라이선스 검사를 통과했습니다. 등록된 self-hosted G7 러너가 없어 동등한 alpha 릴리스 게이트를 전용 로컬 G7에서 실행했고 대기 중 릴리스 workflow는 취소했습니다.
- 공개 릴리스와 승인된 원격 staging 적용 ZIP의 SHA-256은 `a7341fa74779033a592a518718fdcc3b26fbb71ab7330bb61b0f413001b8e63f`로 일치합니다. 원격 entrypoint·manifest·components·JS·vendor bundle 6개 파일도 로컬 릴리스 입력과 동일합니다.
- `--apply` 업데이트 후 JWSoft alpha.19 active / CKEditor inactive이며 선행 위험 확인 설정 없이 활성화했습니다. 전용 로컬 G7에서 양방향 동시 활성화 차단과 전환 후 복귀를 확인했습니다.
- 실제 인증된 관리자 브라우저에서 설정 페이지 진입, 안내 문구, 설정 저장·재조회·원복(높이 400 → 401 → 400)을 확인했습니다. 다른 기능 스위치는 변경하지 않았습니다.
- 새 페이지 작성은 단일 JWSoft 편집기가 경고 없이 편집 가능한 상태입니다. 기존 서식이 있는 페이지의 수정 화면에는 수정 후 저장 시의 위험 안내가 표시되고 확인 전 읽기 전용입니다. 새 문서나 기존 문서는 저장하지 않았습니다.
- 배포 전후 페이지 6건·게시글 50,005건·상품 20,000건, 총 70,011건의 저장 본문 해시와 기존 코어 변경 상태가 동일합니다. 에디터 설치·활성화·조회가 기존 저장 본문을 바꾸지 않음을 확인했습니다.
- `test-results/deploy/staging.json`은 이번 적용의 health smoke 증거입니다. stable readiness의 별도 통합 증거 반영과 production 동일 checksum 적용은 완료한 것으로 간주하지 않습니다. 이 릴리스는 계속 개발·staging용 alpha입니다.
