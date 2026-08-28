# 설치 문서

> 현재 alpha는 전용 G7 하네스 검증용이며 운영 설치를 지원하지 않습니다. 아래 절차는 parity gate와 staging gate 통과 후 릴리스 패키지에 적용합니다.

## 요구사항

- G7 7.0.9 이상
- PHP 8.2 이상
- ZIP 확장
- G7 플러그인 디렉터리 쓰기 권한
- 빌드된 릴리스 ZIP과 SHA256SUMS
- 제품 `LICENSE`, `THIRD_PARTY_NOTICES.md`, `licenses/` manifest·원문

운영 설치에는 Node와 Composer가 필요하지 않습니다. `dist/`와 PHP `vendor/`가 릴리스 ZIP에 포함됩니다.

## 최초 설치

1. checksum을 검증합니다.
2. ZIP을 임시 디렉터리에 풉니다.
3. `plugin.json`이 ZIP 루트 또는 1단계 하위에 있는지 확인합니다.
4. 플러그인을 `plugins/_pending/jwsoft-tiptap-editor`에 배치합니다.
5. G7 루트에서 플러그인을 설치합니다.

```bash
php artisan plugin:install jwsoft-tiptap-editor --vendor-mode=bundled
```

6. 관리자 `플러그인 → JWSoft Tiptap 에디터 → 설정`에서 **기존 콘텐츠 전환 위험 확인**을 켜고 저장합니다.
   이미지 파일 드롭과 클립보드 업로드는 각각 `이미지 드래그·드롭 업로드`, `클립보드 이미지 업로드`에서 켜거나 끌 수 있습니다.
   동영상은 `동영상 플레이어 삽입`을 먼저 켠 뒤 YouTube·Vimeo·MP4 제공자와 URL 자동 변환을 선택합니다. 외부 로드는 기본 `클릭 후`, 자동재생은 기본 꺼짐입니다.
7. 아래 순서로 편집기를 전환합니다.

```bash
php artisan plugin:deactivate sirsoft-ckeditor5
php artisan plugin:activate jwsoft-tiptap-editor
php artisan optimize:clear
```

> 기존 CKEditor의 inline style·전용 class·HTML 구조는 JWSoft에서 편집·저장할 때 달라질 수 있으며 자동 변환되지 않습니다. 문제가 생기면 JWSoft를 비활성화하고 CKEditor를 다시 활성화하십시오. 설정 확인 전에는 JWSoft 활성화가 차단됩니다.

CKEditor가 설치되지 않은 환경에서는 deactivate 실패를 무시하지 말고 설치 상태를 먼저 확인합니다. 배포 하네스는 `DEPLOY_MODE=install` 또는 `update`를 명시적으로 받으며 상태를 추측하지 않습니다.

두 replace-mode editor의 동시 활성화는 차단됩니다. G7 7.0.9 관리자 경로는 활성화 전 차단하며, `plugin:activate` CLI가 사전 훅을 우회하는 경우에도 CKEditor 상태를 즉시 되돌리고 명령을 실패 처리합니다.

## 업데이트

```bash
php artisan plugin:update jwsoft-tiptap-editor \
  --zip=/absolute/path/jwsoft-tiptap-editor-VERSION.zip \
  --force \
  --vendor-mode=bundled \
  --layout-strategy=overwrite
php artisan optimize:clear
```

## 전환 확인

- `legacyContentRiskAcknowledged=true` 저장과 활성화 경고 확인
- 게시판 작성 화면에 JWSoft editor가 1개만 존재
- 네트워크에 Tiptap/CKEditor CDN 요청 없음
- 기존 글 열기·수정·저장·조회 성공
- 이미지 업로드와 조회 성공
- 상품·페이지·다국어 smoke 성공

## 롤백

HTML이 저장 정본이므로 DB 형식 일괄 변환 없이 플러그인 전환이 가능해야 합니다. 다만 롤백은 이후 편집기 선택을 되돌릴 뿐, JWSoft로 이미 저장해 달라진 기존 HTML 원문을 복원하지 않습니다.

```bash
php artisan plugin:deactivate jwsoft-tiptap-editor
php artisan plugin:activate sirsoft-ckeditor5
php artisan optimize:clear
```

롤백 후 편집·조회 smoke를 다시 실행합니다. MVP 6 하네스에서는 페이지·게시글·상품 canonical HTML과 이미지 레코드 수가 alpha.6 → alpha.7 업데이트·롤백·복구 전후 동일함을 해시로 검증합니다. jwsoft 전용 class token은 CKEditor에서도 HTML class로 보존되지만 해당 CSS 제공 여부는 전환 문서에서 확인합니다.
