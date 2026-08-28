# 배포 하네스

## 원칙

- `--plan`이 기본이며 서버를 변경하지 않습니다.
- `--apply`가 없으면 변경하지 않습니다.
- production은 `PRODUCTION_APPROVAL=jwsoft-tiptap-editor-production`이 추가로 필요합니다.
- install/update 모드를 추측하지 않습니다.
- staging에 사용한 artifact checksum만 production에 허용합니다.

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
5. CKEditor 비활성화
6. jwsoft 활성화
7. cache clear
8. smoke
9. 실패 시 즉시 역순 rollback

하네스는 DB 전체 백업을 자동으로 만들지 않습니다. 이 플러그인은 기존 HTML 필드를 유지하며 G7 plugin update의 파일 백업·복원을 사용합니다. 적용 실패 시 하네스는 jwsoft를 비활성화하고 CKEditor 재활성화를 시도합니다. DB migration이 추가되는 릴리스는 별도 migration/backup ADR과 운영 승인 없이는 배포할 수 없습니다.
