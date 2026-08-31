# CKEditor 본문 저장 실패 및 에디터 중복 활성화 방지 요청

## 증상

새 게시글 작성 중 화면 너비를 변경한 뒤 등록하면, CKEditor에는 본문이 보이지만 **“내용은 필수입니다.”** 오류로 저장되지 않습니다. 너비 변경 없는 대조 흐름에서는 정상 저장됐습니다.

## 최초 재현 환경

- G7 `7.0.9`, `sirsoft-ckeditor5` `1.0.2`
- `sirsoft-board` `1.0.5`, 기본 템플릿 `sirsoft-basic` `1.1.1`
- Page Builder `0.29.0` 공개 셸 사용
- CKEditor만 활성화
- 브라우저 재현 및 사용자 실기기 검증 완료

## 재현 절차

1. 새 글 작성에서 제목과 본문을 입력합니다.
2. 화면 크기를 변경했다가 원래 크기로 돌아옵니다.
3. 본문을 다시 수정하지 않고 등록합니다.

기대 결과: 화면에 입력한 본문이 그대로 저장됩니다.

실제 결과: 본문이 화면에 남아 있는데도 “내용은 필수입니다.” 오류가 표시됩니다.

## 유력 원인: 에디터 본문과 제출용 폼 상태의 동기화 불일치

- CKEditor의 `syncToForm()`은 `state.setLocal()`에 `debounce: 300`, `render: false`, `selfManaged: true`를 사용합니다.
- G7 `DynamicRenderer`는 반응형 재렌더 후 임시 상태 `__g7PendingLocalState`를 비웁니다.
- 저장 버튼의 첫 `setState({ isSaving: true })`에서 G7 `ActionDispatcher`가 임시 상태 또는 기존 `context.state`를 기준으로 전체 폼을 다시 구성합니다. 기존 context가 오래된 값이면 최신 본문을 초기 빈 값으로 덮을 수 있습니다.

독립 DOM 테스트에서는 이 덮어쓰기 경로가 재현됐습니다. **CKEditor–G7 상태 동기화 경로가 유력하며, 실제 저장 요청에서 정확한 원인 지점 확인이 필요합니다.**

확인할 코드:

- `plugins/sirsoft-ckeditor5/resources/js/handlers/initEditor.ts` — `syncToForm()`
- `resources/js/core/template-engine/DynamicRenderer.tsx` — pending 상태 초기화
- `resources/js/core/template-engine/ActionDispatcher.ts` — `handleSetState()`, `flushPendingDebounceTimers()`

## 확인 요청

저장 직전 **CKEditor `getData()` → 폼의 `content` → 실제 POST 요청의 `content`**를 비교하여 값이 사라지는 지점을 확인해 주십시오.

## 추가 개선: 다른 에디터 플러그인 자동 비활성화

- CKEditor 활성화 시 다른 활성 에디터 플러그인을 자동 비활성화하여 **하나의 에디터만 활성 상태**로 유지해 주십시오.
- 향후 배포되는 에디터도 대상으로 포함되도록, 특정 플러그인 이름이 아니라 **에디터 대체 기능**을 기준으로 판별해 주십시오. 일반 플러그인은 대상에서 제외해야 합니다.
- 전환 결과와 자동 비활성화된 에디터를 관리자에게 안내하고, 전환 실패 시 기존 에디터 상태를 복구해 주십시오.
