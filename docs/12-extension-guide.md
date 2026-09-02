# jw-editor 확장 가이드

## 현재 제공하는 경계

`resources/js/editor/modules.ts`는 번들에 포함된 기본 편집·이미지·표·미디어·SNS 확장을 조립합니다. 각 모듈은 독립 factory로 설정을 받고 Tiptap extensions를 반환합니다. `createEditor.ts`는 조립된 schema와 편집 이벤트를 연결하고 G7 상태 동기화는 `handlers/initEditor.ts`가 담당합니다.

| 영역              | 현재 진입점                                                                    | 확장할 때 함께 확인할 부분                          |
| ----------------- | ------------------------------------------------------------------------------ | --------------------------------------------------- |
| 서식·새 문서 요소 | `editor/modules.ts`, `classTokens.ts`, `inlineStyle.ts`                        | 서버 HTML 정책, 저장 왕복, 조회 CSS                 |
| 이미지 업로더     | `imageUpload.ts`, `imageUploadQueue.ts`, 서버 image service와 공개 image hooks | 인증·권한·MIME·크기·파일 정리·모달·드롭/붙여넣기    |
| MP4 업로더        | `mediaUpload.ts`, 서버 media service                                           | 청크 hash·재시도·재개·만료·Range·원본명             |
| 영상 표시         | `mediaEmbed.ts`, `mediaView.ts`, `mediaPlayer.ts`, `mediaRenderer.ts`          | 편집/조회 일치, allowlist, 런타임 DOM 저장 금지     |
| SNS               | `smartCard.ts`, `socialPolicy.ts`, `socialPlayer.ts`                           | SSRF, 공식 제공자 화이트리스트, 실패 시 원 URL 보존 |
| 도움말·HTML 조회  | `editorFooter.ts`, `dialog.ts`                                                 | 읽기 전용, 명시적 복사, focus/cleanup, 본문과 분리  |

모듈 분리는 **소스·번들 수준**입니다. 현재 런타임에서 임의 확장을 등록하거나 URL에서 모듈을 내려받는 공개 API는 없습니다. 별도 설치 가능한 플러그인 SDK를 제공한다고 표현하지 않습니다. 업로더 교체 역시 프런트엔드 함수만 교체하면 끝나는 계약이 아닙니다.

## 새 기능을 추가하는 절차

1. 저장 형식을 바꾸는지 먼저 판단합니다. UI만 추가한다면 저장 schema를 바꾸지 않습니다.
2. 새 요소·속성이 필요하면 `policy/editor-policy.json`의 허용 범위와 서버 sanitizer, 클라이언트 생성 정책을 같이 변경합니다.
3. 내부 모듈 factory에 확장을 조립합니다. 기능 OFF는 새 삽입을 막는 설정이며 기존 저장 문서 parser를 제거하는 설정이 아닙니다.
4. 편집기 NodeView와 글보기 renderer를 함께 검증합니다. 실제 플레이어 DOM은 HTML 정본에 저장하지 않습니다.
5. 문서·설정·번역·CHANGELOG·단위/통합/브라우저 왕복 테스트를 추가합니다. 공개 훅·API를 추가할 때는 계약과 버전 정책을 별도로 문서화합니다.
6. 현재 입력과 같은 패키지로 릴리스 gate를 통과한 뒤 배포합니다.

## 소스보기와 Tiptap API

Tiptap은 [Extension API](https://tiptap.dev/docs/editor/extensions/custom-extensions/create-new/extension), HTML 직렬화와 [setContent](https://tiptap.dev/docs/editor/api/commands/content/set-content)를 제공합니다. 완성된 업로더·G7 통합·소스편집 UI를 자동 제공하는 것은 아닙니다.

jw-editor의 도움말은 현재 편집 상태를 정제한 HTML을 읽고 복사하는 기능만 제공합니다. `setContent`를 사용자 입력 원문에 직접 연결하지 않습니다. HTML 코드 편집을 도입하려면 손실 미리보기·서버 검증·취소/실행취소와 기존 정책 유지에 대한 별도 승인·검증이 필요합니다.
