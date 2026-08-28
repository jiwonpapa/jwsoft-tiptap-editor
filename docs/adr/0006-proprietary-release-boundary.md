# ADR-0006: Proprietary 출시 경계

- 상태: ADR-0010으로 대체됨
- 날짜: 2026-08-28

## 결정

제품 코드는 Proprietary로 유지하고 승인된 비공개 배포만 허용합니다. NPM 패키지는 `private: true`와 `UNLICENSED`, Composer는 `proprietary`, 플러그인 manifest는 `Proprietary`를 사용합니다. 공개 저장소 전환이나 재배포 허용은 별도 라이선스 ADR과 사용자 승인이 필요합니다.

공개 저장소 전환 결정은 [ADR-0010](0010-public-github-install-source.md)을 따릅니다.

## 이유

Tiptap core·ProseMirror 등 허용적인 제3자 라이선스가 제품 코드의 공개 라이선스를 결정하지 않습니다. 제품 소유권과 공개 배포 결정을 보존하면서 모든 런타임 의존성 고지는 충족해야 합니다.

## 결과

릴리스 ZIP은 제품 `LICENSE`, `THIRD_PARTY_NOTICES.md`, NPM 원문 라이선스, NPM·Composer manifest와 Composer vendor bundle을 포함합니다. 라이선스 audit 또는 재현 checksum 증거가 없으면 출시 후보 gate가 실패하며, 전체 P0와 staging 증거가 없으면 stable gate가 실패합니다.
