export const EDITOR_STYLE_ID = "jwsoft-tiptap-editor-styles";
export const CONTENT_STYLE_ID = "jwsoft-tiptap-content-styles";

const editorCss = `
.jwsoft-tiptap-wrapper { color: #111827; }
.jwsoft-tiptap-shell { border: 1px solid #d1d5db; border-radius: 0.5rem; background: #fff; overflow: hidden; }
.jwsoft-tiptap-stage-notice { padding: 0.625rem 0.75rem; border-bottom: 1px solid #fde68a; background: #fffbeb; color: #92400e; font-size: 0.75rem; line-height: 1.25rem; }
.jwsoft-tiptap-editable { min-height: var(--jwsoft-tiptap-height, 400px); padding: 1rem; outline: none; line-height: 1.7; }
.jwsoft-tiptap-editable[contenteditable="false"] { background: #f9fafb; cursor: not-allowed; }
.jwsoft-tiptap-editable p.is-editor-empty:first-child::before { content: attr(data-placeholder); float: left; height: 0; color: #9ca3af; pointer-events: none; }
.jwsoft-tiptap-locale-tabs { display: flex; gap: 0.5rem; padding: 0.75rem; border-bottom: 1px solid #e5e7eb; }
.jwsoft-tiptap-locale-tab { border: 1px solid #d1d5db; border-radius: 9999px; background: #fff; color: #374151; padding: 0.375rem 0.75rem; font-size: 0.75rem; cursor: pointer; }
.jwsoft-tiptap-locale-tab[aria-selected="true"] { border-color: #2563eb; background: #2563eb; color: #fff; }
html.dark .jwsoft-tiptap-shell { border-color: #4b5563; background: #1f2937; }
html.dark .jwsoft-tiptap-stage-notice { border-color: #92400e; background: #451a03; color: #fde68a; }
html.dark .jwsoft-tiptap-editable { color: #f3f4f6; }
html.dark .jwsoft-tiptap-editable[contenteditable="false"] { background: #111827; }
html.dark .jwsoft-tiptap-locale-tab { border-color: #4b5563; background: #1f2937; color: #d1d5db; }
`;

const contentCss = `
.jwsoft-tiptap-content { line-height: 1.7; overflow-wrap: anywhere; }
.jwsoft-tiptap-content ul { list-style: disc; padding-left: 2rem; }
.jwsoft-tiptap-content ol { list-style: decimal; padding-left: 2rem; }
.jwsoft-tiptap-content pre { overflow-x: auto; border-radius: 0.375rem; background: #111827; color: #f9fafb; padding: 0.75rem; }
.jwsoft-tiptap-content table { width: 100%; border-collapse: collapse; }
.jwsoft-tiptap-content th, .jwsoft-tiptap-content td { border: 1px solid #d1d5db; padding: 0.5rem; }
.jwsoft-tiptap-content img { max-width: 100%; height: auto; }
`;

function injectStyle(id: string, css: string): void {
  if (document.getElementById(id)) return;
  const style = document.createElement("style");
  style.id = id;
  style.textContent = css;
  document.head.appendChild(style);
}

export function injectEditorStyles(): void {
  injectStyle(EDITOR_STYLE_ID, editorCss);
}

export function injectContentStyles(): void {
  injectStyle(CONTENT_STYLE_ID, contentCss);
}
