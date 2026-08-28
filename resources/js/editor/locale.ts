const ENGLISH_COPY: Record<string, string> = {
  한국어: "Korean",
  "안전한 HTML 저장 정책 적용": "Safe HTML storage policy applied",
  "이 편집기는 현재 읽기 전용입니다.": "This editor is read-only.",
  "붙여넣기에서 지원하지 않는 서식을 제거했습니다. 필요하면 실행취소할 수 있습니다.":
    "Unsupported pasted formatting was removed. You can undo if needed.",
  "기존 CKEditor 콘텐츠에 inline style·전용 class·지원하지 않는 HTML이 있습니다. 편집하거나 저장하면 서식이 달라질 수 있으며 자동 변환되지 않습니다. 원문을 유지하려면 읽기 전용을 선택하고, 전환 문제가 있으면 JWSoft를 비활성화한 뒤 CKEditor를 다시 활성화하십시오. 변경 결과를 확인하기 전에는 저장이 차단됩니다.":
    "Legacy CKEditor content contains inline styles, custom classes, or unsupported HTML. Formatting may change during editing or saving and is not migrated automatically. Keep the document read-only to preserve the original, or deactivate JWSoft and reactivate CKEditor if the transition causes problems. Saving is blocked until you review the changes.",
  "위험 확인 후 편집 계속": "Acknowledge risk and continue",
  "읽기 전용 유지": "Keep read-only",
  "읽기 전용으로 유지했습니다. 변경을 승인하기 전에는 저장이 차단됩니다.":
    "The editor remains read-only. Saving is blocked until you approve the changes.",
  "sirsoft-ckeditor5가 함께 로드되어 JWSoft Tiptap 에디터 시작을 차단했습니다.":
    "JWSoft Tiptap Editor was blocked because sirsoft-ckeditor5 is also loaded.",
  작게: "Small",
  기본: "Default",
  크게: "Large",
  "매우 크게": "Extra large",
  왼쪽: "Left",
  가운데: "Center",
  오른쪽: "Right",
  좁게: "Tight",
  넓게: "Relaxed",
  "기본 표": "Default table",
  "줄무늬 표": "Striped table",
  "글 안": "Inline",
  "가운데 블록": "Centered block",
  "둥근 모서리": "Rounded corners",
  "문단 종류": "Block type",
  본문: "Paragraph",
  "제목 2": "Heading 2",
  "제목 3": "Heading 3",
  "제목 4": "Heading 4",
  "코드 블록": "Code block",
  닫기: "Close",
  "새 창에서 열기": "Open in a new window",
  "링크 적용": "Apply link",
  "링크 해제": "Remove link",
  주소: "URL",
  설명: "Description",
  링크: "Link",
  "https, mailto, tel 또는 상대 경로만 사용할 수 있습니다.":
    "Only https, mailto, tel, or relative URLs are allowed.",
  "표 삽입": "Insert table",
  행: "Rows",
  열: "Columns",
  "표 만들기": "Create table",
  "행과 열은 각각 1~20 사이여야 합니다.":
    "Rows and columns must each be between 1 and 20.",
  "이미지 삽입": "Insert image",
  "이미지 파일": "Image file",
  "또는 이미지 주소": "Or image URL",
  "이미지 주소": "Image URL",
  "대체 텍스트": "Alternative text",
  이미지: "Image",
  "이미지를 업로드하는 중입니다…": "Uploading image…",
  "업로드 완료. 본문에 삽입합니다.": "Upload complete. Inserting into content.",
  "이미지 업로드에 실패했습니다.": "Image upload failed.",
  "이미지 {{current}}/{{total}} 업로드 중…":
    "Uploading image {{current}}/{{total}}…",
  "이미지 {{count}}개를 업로드해 삽입했습니다.":
    "Uploaded and inserted {{count}} image(s).",
  "https 또는 상대 경로 이미지만 사용할 수 있습니다.":
    "Only https or relative image URLs are allowed.",
  문단: "Blocks",
  "글자 서식": "Inline formatting",
  굵게: "Bold",
  "굵게 (Ctrl/Command+B)": "Bold (Ctrl/Command+B)",
  기울임: "Italic",
  "기울임 (Ctrl/Command+I)": "Italic (Ctrl/Command+I)",
  밑줄: "Underline",
  "밑줄 (Ctrl/Command+U)": "Underline (Ctrl/Command+U)",
  취소선: "Strikethrough",
  코드: "Code",
  구조: "Structure",
  인용: "Blockquote",
  목록: "Bullets",
  "글머리 목록": "Bullet list",
  번호: "Numbering",
  "번호 목록": "Numbered list",
  구분선: "Horizontal rule",
  "문단 모양": "Block layout",
  "문단 크기": "Text size",
  정렬: "Alignment",
  "줄 간격": "Line spacing",
  삽입: "Insert",
  표: "Table",
  "표 편집": "Table editing",
  "행+": "Add row",
  "행−": "Delete row",
  "열+": "Add column",
  "열−": "Delete column",
  "표 삭제": "Delete table",
  기록: "History",
  실행취소: "Undo",
  "실행취소 (Ctrl/Command+Z)": "Undo (Ctrl/Command+Z)",
  다시실행: "Redo",
  "다시실행 (Ctrl/Command+Shift+Z)": "Redo (Ctrl/Command+Shift+Z)",
  "편집 도구": "editor tools",
  "JPEG, PNG, GIF, WebP, AVIF 이미지만 업로드할 수 있습니다.":
    "Only JPEG, PNG, GIF, WebP, and AVIF images can be uploaded.",
};

export function normalizeEditorLocale(locale: unknown): "ko" | "en" {
  return locale === "en" ? "en" : "ko";
}

export function editorText(
  locale: unknown,
  korean: string,
  replacements: Record<string, string | number> = {},
): string {
  let output =
    normalizeEditorLocale(locale) === "en"
      ? (ENGLISH_COPY[korean] ?? korean)
      : korean;
  for (const [key, value] of Object.entries(replacements)) {
    output = output.split(`{{${key}}}`).join(String(value));
  }
  return output;
}
