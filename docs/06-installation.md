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
5. G7 루트에서 실행합니다.

```bash
php artisan plugin:install jwsoft-tiptap-editor --vendor-mode=bundled
php artisan plugin:deactivate sirsoft-ckeditor5
php artisan plugin:activate jwsoft-tiptap-editor
php artisan optimize:clear
```

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

- 게시판 작성 화면에 JWSoft editor가 1개만 존재
- 네트워크에 Tiptap/CKEditor CDN 요청 없음
- 기존 글 열기·수정·저장·조회 성공
- 이미지 업로드와 조회 성공
- 상품·페이지·다국어 smoke 성공

## 롤백

HTML이 저장 정본이므로 DB 형식 변환 없이 플러그인 전환이 가능해야 합니다.

```bash
php artisan plugin:deactivate jwsoft-tiptap-editor
php artisan plugin:activate sirsoft-ckeditor5
php artisan optimize:clear
```

롤백 후 편집·조회 smoke를 다시 실행합니다. MVP 6 하네스에서는 페이지·게시글·상품 canonical HTML과 이미지 레코드 수가 alpha.6 → alpha.7 업데이트·롤백·복구 전후 동일함을 해시로 검증합니다. jwsoft 전용 class token은 CKEditor에서도 HTML class로 보존되지만 해당 CSS 제공 여부는 전환 문서에서 확인합니다.
