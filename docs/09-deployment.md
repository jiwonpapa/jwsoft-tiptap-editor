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
- 원격 적용 전 관리자 설정에서 `legacyContentRiskAcknowledged=true`를 명시적으로 저장해야 합니다. 하네스가 이 확인을 대신하거나 기존 HTML을 자동 변환하지 않습니다.

## 환경 파일

```bash
cp deploy/environments/staging.env.example deploy/environments/staging.env
```

실제 `.env` 파일은 gitignore 대상입니다.

최초 설치 후 전환 위험 확인 설정이 꺼져 있으면 종료 코드 42로 활성화를 보류하고 기존 에디터를 유지합니다. 이 상태는 배포 smoke 통과로 기록하지 않습니다. 관리자가 확인 설정을 저장한 뒤 `DEPLOY_MODE=update`로 다시 적용하면 전환을 진행합니다.

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
6. 기존 콘텐츠 전환 위험 확인 설정 검증
7. CKEditor 비활성화
8. jwsoft 활성화
9. cache clear
10. smoke와 배포 증거 기록

하네스는 DB 전체 백업을 자동으로 만들지 않습니다. 이 플러그인은 기존 HTML 필드를 유지하며 G7 plugin update의 파일 백업·복원을 사용합니다. 적용 실패 시 하네스는 jwsoft를 비활성화하고 CKEditor 재활성화를 시도합니다. DB migration이 추가되는 릴리스는 별도 migration/backup ADR과 운영 승인 없이는 배포할 수 없습니다.

staging smoke가 통과하면 `test-results/deploy/staging.json`에 artifact checksum과 대상·smoke URL의 SHA-256 지문만 기록합니다. production 계획·적용은 이 staging 증거와 `APPROVED_STAGING_SHA256`가 현재 artifact에 모두 일치해야 하며, 성공 후 `production.json`을 기록합니다. 원격 호스트·경로·URL 원문과 비밀값은 증거에 저장하지 않습니다.

`alpha.18`은 전용 로컬 G7에서 공개 GitHub 최초 설치, `alpha.16 → alpha.18` 업데이트, uninstall, CKEditor rollback, JWSoft restore와 콘텐츠 해시 보존을 검증한 공개 개발 릴리스입니다. 실제 `deploy/environments/staging.env`·`production.env`, 대상 정보와 배포 승인이 없으므로 원격 staging 또는 production 적용 증거로 해석하지 않습니다.
