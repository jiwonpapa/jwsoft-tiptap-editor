import { EDITOR_TOKEN_CSS } from "@/generated/editorPolicy";

export const EDITOR_STYLE_ID = "jwsoft-tiptap-editor-styles";
export const CONTENT_STYLE_ID = "jwsoft-tiptap-content-styles";

const editorCss = `
.jwsoft-tiptap-wrapper { color: #111827; font-family: inherit; }
.jwsoft-tiptap-shell { border: 1px solid #d1d5db; border-radius: 0.625rem; background: #fff; overflow: hidden; }
.jwsoft-tiptap-stage-notice { padding: 0.625rem 0.75rem; border-bottom: 1px solid #fde68a; background: #fffbeb; color: #92400e; font-size: 0.75rem; line-height: 1.25rem; }
.jwsoft-tiptap-status { padding: 0.375rem 0.75rem; border-bottom: 1px solid #e5e7eb; background: #f9fafb; color: #6b7280; font-size: 0.6875rem; line-height: 1.25rem; letter-spacing: 0.01em; }
.jwsoft-tiptap-status[data-tone="warning"] { border-color: #fde68a; background: #fffbeb; color: #92400e; }
.jwsoft-tiptap-legacy-warning { padding: 0.75rem; border-bottom: 1px solid #fca5a5; background: #fef2f2; color: #991b1b; font-size: 0.875rem; }
.jwsoft-tiptap-legacy-actions { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.625rem; }
.jwsoft-tiptap-legacy-action { min-height: 2.25rem; border: 1px solid #b91c1c; border-radius: 0.375rem; padding: 0.375rem 0.625rem; background: #fff; color: #991b1b; cursor: pointer; }
.jwsoft-tiptap-legacy-action[data-primary="true"] { background: #b91c1c; color: #fff; }
.jwsoft-tiptap-editor-frame[hidden] { display: none; }
.jwsoft-tiptap-toolbar-region { position: relative; border-bottom: 1px solid #e5e7eb; background: #fff; }
.jwsoft-tiptap-toolbar { display: flex; align-items: stretch; gap: 0; max-width: 100%; overflow-x: auto; overscroll-behavior-inline: contain; scrollbar-width: thin; }
.jwsoft-tiptap-tool-group { display: flex; flex: 0 0 auto; align-items: center; gap: 0.25rem; padding: 0.375rem; border-right: 1px solid #e5e7eb; }
.jwsoft-tiptap-tool-group:last-child { border-right: 0; }
.jwsoft-tiptap-tool, .jwsoft-tiptap-select { min-height: 2.25rem; border: 1px solid transparent; border-radius: 0.375rem; background: transparent; color: #374151; font: inherit; font-size: 0.75rem; line-height: 1rem; white-space: nowrap; }
.jwsoft-tiptap-tool { padding: 0.375rem 0.5rem; cursor: pointer; }
.jwsoft-tiptap-select { max-width: 7.5rem; padding: 0.375rem 1.5rem 0.375rem 0.5rem; cursor: pointer; }
.jwsoft-tiptap-tool:hover, .jwsoft-tiptap-select:hover { background: #f3f4f6; color: #111827; }
.jwsoft-tiptap-tool:focus-visible, .jwsoft-tiptap-select:focus-visible, .jwsoft-tiptap-dialog input:focus-visible, .jwsoft-tiptap-dialog button:focus-visible { outline: 2px solid #2563eb; outline-offset: 1px; }
.jwsoft-tiptap-tool[aria-pressed="true"] { border-color: #bfdbfe; background: #eff6ff; color: #1d4ed8; }
.jwsoft-tiptap-tool:disabled, .jwsoft-tiptap-select:disabled { color: #9ca3af; cursor: not-allowed; opacity: 0.65; }
.jwsoft-tiptap-dialog { padding: 0.75rem; border-top: 1px solid #dbeafe; background: #f8fafc; }
.jwsoft-tiptap-dialog[hidden] { display: none; }
.jwsoft-tiptap-dialog-header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-bottom: 0.625rem; color: #111827; font-size: 0.8125rem; }
.jwsoft-tiptap-dialog-close, .jwsoft-tiptap-dialog-actions button, .jwsoft-tiptap-dialog-form > button { min-height: 2.25rem; border: 1px solid #d1d5db; border-radius: 0.375rem; padding: 0.375rem 0.625rem; background: #fff; color: #374151; cursor: pointer; }
.jwsoft-tiptap-dialog-form { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(12rem, 100%), 1fr)); align-items: end; gap: 0.625rem; }
.jwsoft-tiptap-field { display: grid; gap: 0.25rem; color: #4b5563; font-size: 0.6875rem; }
.jwsoft-tiptap-field input:not([type="checkbox"]) { min-height: 2.25rem; box-sizing: border-box; width: 100%; border: 1px solid #d1d5db; border-radius: 0.375rem; padding: 0.375rem 0.5rem; background: #fff; color: #111827; font: inherit; font-size: 0.8125rem; }
.jwsoft-tiptap-field-inline { display: flex; flex-direction: row-reverse; justify-content: flex-end; align-items: center; align-self: center; }
.jwsoft-tiptap-dialog-actions { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.jwsoft-tiptap-dialog-primary { border-color: #2563eb !important; background: #2563eb !important; color: #fff !important; }
.jwsoft-tiptap-dialog-error { grid-column: 1 / -1; color: #b91c1c; font-size: 0.75rem; }
.jwsoft-tiptap-editable { min-height: var(--jwsoft-tiptap-height, 400px); padding: 1rem; outline: none; line-height: 1.7; }
.jwsoft-tiptap-editable[contenteditable="false"] { background: #f9fafb; cursor: not-allowed; }
.jwsoft-tiptap-editable p.is-editor-empty:first-child::before { content: attr(data-placeholder); float: left; height: 0; color: #9ca3af; pointer-events: none; }
.jwsoft-tiptap-editable h2, .jwsoft-tiptap-editable h3, .jwsoft-tiptap-editable h4 { margin-block: 1.25em 0.5em; font-weight: 700; line-height: 1.3; }
.jwsoft-tiptap-editable h2 { font-size: 1.5rem; }
.jwsoft-tiptap-editable h3 { font-size: 1.25rem; }
.jwsoft-tiptap-editable h4 { font-size: 1.125rem; }
.jwsoft-tiptap-editable blockquote { margin-inline: 0; border-left: 3px solid #bfdbfe; padding-left: 0.875rem; color: #4b5563; }
.jwsoft-tiptap-editable ul { list-style: disc; padding-left: 2rem; }
.jwsoft-tiptap-editable ol { list-style: decimal; padding-left: 2rem; }
.jwsoft-tiptap-editable pre { overflow-x: auto; border-radius: 0.375rem; background: #111827; color: #f9fafb; padding: 0.75rem; }
.jwsoft-tiptap-editable table { width: 100%; border-collapse: collapse; }
.jwsoft-tiptap-editable th, .jwsoft-tiptap-editable td { min-width: 4rem; border: 1px solid #d1d5db; padding: 0.5rem; vertical-align: top; }
.jwsoft-tiptap-editable img { max-width: 100%; height: auto; }
.jwsoft-tiptap-locale-tabs { display: flex; gap: 0.5rem; padding: 0.75rem; border-bottom: 1px solid #e5e7eb; }
.jwsoft-tiptap-locale-tab { min-height: 2.25rem; border: 1px solid transparent; border-radius: 0.375rem; background: transparent; color: #4b5563; padding: 0.375rem 0.75rem; font-size: 0.75rem; cursor: pointer; }
.jwsoft-tiptap-locale-tab[aria-selected="true"] { border-color: #bfdbfe; background: #eff6ff; color: #1d4ed8; }
html.dark .jwsoft-tiptap-shell { border-color: #4b5563; background: #1f2937; }
html.dark .jwsoft-tiptap-stage-notice { border-color: #92400e; background: #451a03; color: #fde68a; }
html.dark .jwsoft-tiptap-status { border-color: #374151; background: #111827; color: #9ca3af; }
html.dark .jwsoft-tiptap-status[data-tone="warning"] { border-color: #92400e; background: #451a03; color: #fde68a; }
html.dark .jwsoft-tiptap-legacy-warning { border-color: #991b1b; background: #450a0a; color: #fecaca; }
html.dark .jwsoft-tiptap-legacy-action { border-color: #f87171; background: #1f2937; color: #fecaca; }
html.dark .jwsoft-tiptap-legacy-action[data-primary="true"] { background: #b91c1c; color: #fff; }
html.dark .jwsoft-tiptap-toolbar-region, html.dark .jwsoft-tiptap-dialog { border-color: #374151; background: #1f2937; }
html.dark .jwsoft-tiptap-tool-group { border-color: #374151; }
html.dark .jwsoft-tiptap-tool, html.dark .jwsoft-tiptap-select { color: #d1d5db; }
html.dark .jwsoft-tiptap-tool:hover, html.dark .jwsoft-tiptap-select:hover { background: #374151; color: #f9fafb; }
html.dark .jwsoft-tiptap-tool[aria-pressed="true"] { border-color: #1d4ed8; background: #172554; color: #bfdbfe; }
html.dark .jwsoft-tiptap-dialog-header, html.dark .jwsoft-tiptap-field { color: #d1d5db; }
html.dark .jwsoft-tiptap-dialog input, html.dark .jwsoft-tiptap-dialog button { border-color: #4b5563; background: #111827; color: #f3f4f6; }
html.dark .jwsoft-tiptap-editable { color: #f3f4f6; }
html.dark .jwsoft-tiptap-editable[contenteditable="false"] { background: #111827; }
html.dark .jwsoft-tiptap-locale-tab { border-color: #4b5563; background: #1f2937; color: #d1d5db; }
@media (max-width: 640px) {
  .jwsoft-tiptap-tool, .jwsoft-tiptap-select { min-height: 2.5rem; }
  .jwsoft-tiptap-editable { padding: 0.875rem; }
  .jwsoft-tiptap-dialog { padding: 0.625rem; }
}
${EDITOR_TOKEN_CSS}
`;

const contentCss = `
.jwsoft-tiptap-content { line-height: 1.7; overflow-wrap: anywhere; }
.jwsoft-tiptap-content ul { list-style: disc; padding-left: 2rem; }
.jwsoft-tiptap-content ol { list-style: decimal; padding-left: 2rem; }
.jwsoft-tiptap-content pre { overflow-x: auto; border-radius: 0.375rem; background: #111827; color: #f9fafb; padding: 0.75rem; }
.jwsoft-tiptap-content table { width: 100%; border-collapse: collapse; }
.jwsoft-tiptap-content th, .jwsoft-tiptap-content td { border: 1px solid #d1d5db; padding: 0.5rem; }
.jwsoft-tiptap-content img { max-width: 100%; height: auto; }
${EDITOR_TOKEN_CSS}
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
