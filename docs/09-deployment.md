# 배포 하네스

## 원칙

- `--plan`이 기본이며 서버를 변경하지 않습니다.
- `--apply`가 없으면 변경하지 않습니다.
- production은 `PRODUCTION_APPROVAL=jwsoft-tiptap-editor-production`이 추가로 필요합니다.
- install/update 모드를 추측하지 않습니다.
- staging에 사용한 artifact checksum만 production에 허용합니다.
- CKEditor 비활성화가 실패해 실제 활성 상태가 남아 있으면 JWSoft 활성화 guard가 배포를 중단합니다.
- 원격 적용 전 관리자 설정에서 `legacyContentRiskAcknowledged=true`를 명시적으로 저장해야 합니다. 하네스가 이 확인을 대신하거나 기존 HTML을 자동 변환하지 않습니다.

## 환경 파일

```bash
cp deploy/environments/staging.env.example deploy/environments/staging.env
```

실제 `.env` 파일은 gitignore 대상입니다.

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
2. artifact upload
3. remote checksum 검증
4. install 또는 update
5. 기존 콘텐츠 전환 위험 확인 설정 검증
6. CKEditor 비활성화
7. jwsoft 활성화
8. cache clear
9. smoke
10. 실패 시 즉시 역순 rollback

하네스는 DB 전체 백업을 자동으로 만들지 않습니다. 이 플러그인은 기존 HTML 필드를 유지하며 G7 plugin update의 파일 백업·복원을 사용합니다. 적용 실패 시 하네스는 jwsoft를 비활성화하고 CKEditor 재활성화를 시도합니다. DB migration이 추가되는 릴리스는 별도 migration/backup ADR과 운영 승인 없이는 배포할 수 없습니다.

`alpha.18`은 전용 로컬 G7에서 공개 GitHub 최초 설치, `alpha.16 → alpha.18` 업데이트, uninstall, CKEditor rollback, JWSoft restore와 콘텐츠 해시 보존을 검증한 공개 개발 릴리스입니다. 실제 `deploy/environments/staging.env`·`production.env`, 대상 정보와 배포 승인이 없으므로 원격 staging 또는 production 적용 증거로 해석하지 않습니다.
