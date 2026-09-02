# jw-editor 인트로 이미지

README 소개용 일러스트입니다. 실제 UI 캡처나 기능 검증 증거가 아닙니다. 제품 소유자가 제공한 회사 캐릭터에서 `지원` 한글을 제거하고, 캐릭터·토끼·하트·`JW SOFT` 리본을 유지해 제품 소개에 적용했습니다.

- 제작: built-in imagegen, 2026-09-02
- 파일: [jw-editor-intro.png](jw-editor-intro.png)
- 확인: 제품명·설명 문구, 툴바·선택된 글·사진·동영상으로 편집기 정체성 표현, `지원` 한글 없음, README용 2:1 구도
- 캐릭터 배치: 우측 편집 문서의 작은 삽입 이미지. 선택 테두리와 크기 조절 핸들로 실제 편집 중인 듯 표현하며, 제품명과 문서보다 작게 배치합니다.
- 배경: 밝은 아이보리의 불투명 배경입니다. 투명 PNG로 배포하지 않습니다.
- 적용 범위: 소개 이미지. 에디터 본문에 캐릭터를 삽입하거나 저장하지 않으며 런타임 JS 번들에도 포함하지 않습니다.

## 최종 프롬프트

Use case: compositing. Edit the original jw-editor product introduction banner to add the supplied company mascot as a small inserted image within the document being edited on the right. Keep the warm ivory paper texture, dark editorial typography on the left, exact text "jw-editor" and exact subtitle "Rich-text editor for Gnuboard 7", cobalt-blue accent and wide 2:1 layout. On the right, evolve the paper into a rich-text editing composition: a slim icon toolbar with bold B, italic I, link, image and undo; paragraph lines; a blue text selection and caret; a landscape photo; and a video play block. Insert the small mascot within the lower-right of the document with a thin blue selection box and corner resize handles. The mascot occupies approximately 10-12 percent of the banner width and 22-28 percent of its height, much smaller than the document and product title. Preserve the recognizable face, pink coat, bunny and JW SOFT ribbon. No Korean lettering or checkerboard. Keep the mascot inside the paper margins and harmonize its perspective. The main story is editing text and media, not the character. No extra slogans, feature badges, Tiptap name, browser frame or cards. This is an illustrative editor scene, not an actual application screenshot.
