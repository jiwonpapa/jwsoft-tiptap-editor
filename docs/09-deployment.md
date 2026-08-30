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
- 원격 변경 전에 현재 증거의 사전 60개(staging) 또는 staging 포함 61개(production)를 검사합니다. alpha/beta production은 금지합니다.
- 같은 대상을 단계별로 사용하는 경우 소유자 승인과 `SAME_TARGET_PROMOTION_APPROVED=1`이 필요합니다. 별도 실제 적용·smoke를 수행하며 환경 격리 검증으로 표현하지 않습니다.
- CKEditor 비활성화가 실패해 실제 활성 상태가 남아 있으면 JWSoft 활성화 guard가 배포를 중단합니다.
- 업데이트 후 이미 JWSoft가 활성 상태인 경우 활성화 명령을 반복하지 않습니다. G7 PluginRepository 계약으로 JWSoft active / CKEditor inactive를 전환 전후 확인하며, 명령 성공 코드만으로 완료를 판정하지 않습니다.
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

1. 로컬 단계별 deployment-gate(60/61개)와 artifact·vendor bundle checksum
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

production 증거는 staging JSON의 SHA-256과 적용 시각을 연결하며 staging보다 나중에 실제 적용되어야 합니다. 이전 기록은 `test-results/deploy/history/`에 보존합니다. 완료 후 `make release-check`로 재빌드 없이 전체 62개를 확인합니다. 후보 ZIP의 버전·바이트는 승격 중 변경하지 않습니다. 승인된 단계 분리의 근거는 [ADR 0012](adr/0012-phased-release-promotion.md)입니다.

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

## alpha.20 UI·UX 개선 배포 검증 — 2026-08-30

- 1차 `9976874`, 2차 `37fd232`, 패키징 `41d0f03`, 배포 하네스 보강 `ad7d042`를 차수별 커밋했습니다. 최종 코드 CI, 단위 85개, 데스크톱/모바일 브라우저 17개, G7 통합 및 alpha 후보 게이트를 통과했습니다.
- 전용 G7에서 alpha.19 → alpha.20 ZIP 업데이트, 에디터 동시 활성화 차단, CKEditor 롤백·JWSoft 복귀를 확인했습니다. 테스트 환경에 누락돼 있던 DB 자격증명은 기존 동일 테스트 DB 환경에서 복구했고 코어 파일은 변경하지 않았습니다.
- 첫 원격 업데이트는 파일 교체에 성공했지만 G7의 ‘이미 활성화됨’ 명령 종료 코드를 실패로 받아 CKEditor로 복귀했습니다. 하네스가 PluginRepository의 실제 단일 활성 상태를 확인하도록 수정하고 7개 배포 회귀 검사 후 재적용했습니다.
- 최종 승인 staging 적용은 JWSoft `0.1.0-alpha.20` active / CKEditor inactive, APP_DEBUG=false, health smoke 및 공개 홈페이지 확인까지 완료했습니다. 원격 주요 런타임 파일 7개의 SHA-256이 로컬과 일치합니다.
- 최종 공개 ZIP과 배포 ZIP의 SHA-256은 `9a5547217c0241557683b9515c4a81aff8e67824848fcd98de16d6dfc98c6f0e`입니다. 두 번의 패키지 생성과 라이선스 검사를 통과했습니다.
- 배포 전후 페이지 6건·게시글 50,005건·상품 20,000건, 총 70,011건의 본문 해시가 동일합니다. 이미지·미디어·영상 업로드·스마트카드 ON, 높이 400, standard 툴바 설정을 확인했습니다.
- 실제 인증 관리자 화면에서 G7 FileUploader를 조작하는 검증과 모바일 실기기 키보드 관찰은 남아 있습니다. 상세 증거 경계는 [alpha.20 UI·UX 검증 범위](acceptance/ui-ux-alpha20.md)를 따릅니다. stable 또는 production 승인으로 표현하지 않습니다.

## alpha.21 메뉴 UX 배포 검증 — 2026-08-30

- 메뉴 구현 3개 커밋 뒤, 최신 증거 gate `a9add42`, 버전·JS `e1d4330`, 오프라인 vendor bundle `c7b965e`를 차수별 커밋·푸시했습니다. `c7b965e`의 CI와 전용 G7 alpha 후보 게이트가 통과했습니다.
- 단위 89개, 증거 거부 회귀 14개, 독립 Chromium UI 21개, G7 통합 6개가 통과했습니다. 전체 Playwright 실행의 15개 skip은 viewport 비대상 13개와 별도 G7 URL을 요구하는 환경 검사 2개이며, 통과 수에 포함하지 않았습니다. npm/composer advisory 검사도 통과했습니다.
- 새 ZIP의 반복 빌드 SHA-256은 `464473f99c5596841af368f25c929b785c2bf24a28037b523ade56de2ccf321e`입니다. 공개 Release asset, 전용 G7 설치·업데이트, 승인 staging 적용이 이 ZIP을 사용했습니다. alpha.20의 기존 ZIP은 바꾸지 않았습니다.
- 처음 GitHub prerelease로 등록했을 때 G7이 `releases/latest`의 alpha.20을 선택해 온라인 수명주기 검사가 실패했습니다. 기존 alpha 온라인 배포 방식대로 Latest에 등록한 뒤, ZIP·GitHub 최초 설치, alpha.20 → alpha.21 온라인 업데이트, 데이터 보존 uninstall, CKEditor 롤백·JWSoft 복구를 다시 실행해 통과했습니다. 이 등록 방식은 stable 승인이 아닙니다.
- 승인 staging의 `--apply` 업데이트와 health smoke가 성공했습니다. JWSoft alpha.21 active / CKEditor inactive, APP_DEBUG=false, health·공개 홈페이지 HTTP 200을 확인했습니다.
- 원격 주요 런타임 7개 파일의 SHA-256이 릴리스 입력과 일치하고, 페이지 6건·게시글 50,005건·상품 20,000건, 합계 70,011건의 본문 해시가 배포 전후 동일합니다. 로컬 상세 증거는 `test-results/deploy/alpha21-runtime.json`과 `staging.json`입니다.
- staging 항목은 위 배포·health·활성 상태·런타임 확인 범위로 완료했습니다. 최신 인증 G7 화면 6종과 production 동일 checksum 배포는 별도 미완료입니다. staging을 production으로 재분류하지 않았으며, 전용 G7의 기존 코어 변경 상태도 유지했습니다.
