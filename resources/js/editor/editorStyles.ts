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
.jwsoft-tiptap-upload-hint { grid-column: 1 / -1; color: #6b7280; font-size: 0.6875rem; line-height: 1rem; }
.jwsoft-tiptap-upload-status { grid-column: 1 / -1; border-left: 3px solid #2563eb; padding: 0.375rem 0.5rem; background: #eff6ff; color: #1e40af; font-size: 0.75rem; }
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
html.dark .jwsoft-tiptap-upload-hint { color: #9ca3af; }
html.dark .jwsoft-tiptap-upload-status { border-color: #60a5fa; background: #172554; color: #bfdbfe; }
html.dark .jwsoft-tiptap-editable { color: #f3f4f6; }
html.dark .jwsoft-tiptap-editable[contenteditable="false"] { background: #111827; }
html.dark .jwsoft-tiptap-locale-tab { border-color: #4b5563; background: #1f2937; color: #d1d5db; }
@media (max-width: 640px) {
  .jwsoft-tiptap-tool, .jwsoft-tiptap-select { min-height: 2.5rem; }
  .jwsoft-tiptap-editable { padding: 0.875rem; }
  .jwsoft-tiptap-dialog { padding: 0.625rem; }
}
.jwsoft-sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; border: 0; }
.jwsoft-icon { display: block; flex: 0 0 auto; pointer-events: none; }
.jwsoft-tiptap-shell { --jw-surface: #fff; --jw-muted: #f7f8fa; --jw-border: #e5e7eb; --jw-ink: #20242b; --jw-subtle: #687080; --jw-accent: #2563eb; background: var(--jw-surface); border-color: var(--jw-border); border-radius: 12px; box-shadow: 0 2px 8px #15243b04; overflow: visible; }
.jwsoft-tiptap-status:empty { display: none; }
.jwsoft-tiptap-toolbar-region { border-radius: 12px 12px 0 0; background: var(--jw-surface); border-color: var(--jw-border); }
.jwsoft-tiptap-toolbar { padding: 7px; gap: 5px; align-items: center; overflow: visible; flex-wrap: wrap; }
.jwsoft-tiptap-tool-group { padding: 0 6px 0 0; gap: 2px; align-items: center; border-color: var(--jw-border); }
.jwsoft-tiptap-tool, .jwsoft-tiptap-select { color: var(--jw-ink); background: transparent; height: 36px; min-height: 36px; font-size: 13px; border-radius: 6px; }
.jwsoft-tiptap-tool { position: relative; display: inline-flex; justify-content: center; align-items: center; gap: 6px; min-width: 36px; padding: 7px; transition: background .12s, color .12s; }
.jwsoft-tiptap-tool:hover, .jwsoft-tiptap-select:hover { background: var(--jw-muted); color: var(--jw-ink); }
.jwsoft-tiptap-tool[aria-pressed=true], .jwsoft-tiptap-tool[aria-expanded=true] { border-color: transparent; background: #eff4ff; color: #1d4ed8; }
.jwsoft-tiptap-tool:disabled { color: #a3a9b3; opacity: .55; }
.jwsoft-tiptap-tool[data-tooltip]:hover::after { content: attr(data-tooltip); position: absolute; pointer-events: none; z-index: 30; top: calc(100% + 8px); left: 50%; transform: translateX(-50%); background: #20242b; color: #fff; font: 12px/1.4 system-ui; border-radius: 5px; padding: 6px 9px; white-space: nowrap; box-shadow: 0 3px 12px #0002; }
.jwsoft-tiptap-tool[aria-expanded=true]:hover::after { display: none; }
.jwsoft-tiptap-editable { padding: 28px 32px; color: var(--jw-ink); font-size: 16px; line-height: 1.75; overflow-wrap: anywhere; caret-color: #2563eb; }
.jwsoft-tiptap-editable > :first-child { margin-top: 0; }
.jwsoft-tiptap-editable p { margin-block: .55em; }
.jwsoft-tiptap-editable h2, .jwsoft-tiptap-editable h3, .jwsoft-tiptap-editable h4 { line-height: 1.3; letter-spacing: -.02em; margin: 1.4em 0 .5em; font-weight: 650; }
.jwsoft-tiptap-editable h2 { font-size: 1.65em; }
.jwsoft-tiptap-editable h3 { font-size: 1.35em; }
.jwsoft-tiptap-editable h4 { font-size: 1.15em; }
.jwsoft-tiptap-editable blockquote { border-inline-start: 3px solid #cbd5e1; margin: 1em 0; padding: .25em 1.1em; color: #606978; }
.jwsoft-tiptap-popover { position: fixed; inset: auto; margin: 0; box-sizing: border-box; width: max-content; max-width: calc(100vw - 16px); max-height: calc(100dvh - 24px); overflow: auto; border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px; background: #fff; color: #20242b; box-shadow: 0 10px 40px #14223a24; z-index: 1000; }
.jwsoft-tiptap-popover:popover-open, .jwsoft-tiptap-popover[open] { display: flex; flex-direction: column; gap: 6px; animation: jwsoft-reveal .13s ease-out; }
.jwsoft-tiptap-popover .jwsoft-tiptap-tool-group { border: 0; padding: 5px 0; flex-wrap: wrap; max-width: 330px; }
.jwsoft-tiptap-popover .jwsoft-tiptap-tool-group + .jwsoft-tiptap-tool-group { border-top: 1px solid #edf0f4; }
.jwsoft-menu-text, .jwsoft-menu-check { display: none; }
.jwsoft-tiptap-popover { min-width: 240px; }
.jwsoft-tiptap-popover [data-editor-command] { width: 100%; justify-content: flex-start; gap: 10px; padding-inline: 10px; }
.jwsoft-tiptap-popover .jwsoft-menu-text { display: block; flex: 1; text-align: left; font-weight: 450; }
.jwsoft-tiptap-popover .jwsoft-menu-check { display: block; width: 15px; visibility: hidden; }
.jwsoft-tiptap-popover [aria-pressed=true] > .jwsoft-menu-check { visibility: visible; }
.jwsoft-tiptap-popover [data-editor-command]:hover::after { display: none; }
.jwsoft-menu-section { display: grid; gap: 2px; padding-top: 8px; border-top: 1px solid #edf0f4; }
.jwsoft-tiptap-popover { font-family: inherit; max-width: min(340px, calc(100vw - 16px)); }
.jwsoft-popover-header { position: sticky; top: -12px; z-index: 1; background: inherit; display: flex; align-items: center; justify-content: space-between; gap: 24px; padding: 0 0 6px 10px; border-bottom: 1px solid #edf0f4; margin-bottom: 4px; font-size: 12px; font-weight: 600; color: #697588; }
.jwsoft-popover-header .jwsoft-tiptap-tool { min-width: 28px; height: 28px; min-height: 28px; }
.jwsoft-tiptap-popover .jwsoft-tiptap-tool-group { flex-direction: column; align-items: stretch; width: 100%; padding: 0; }
.jwsoft-tiptap-popover .jwsoft-format-row { padding: 5px 10px; }
.jwsoft-tiptap-popover .jwsoft-format-row select { max-width: 155px; }
.jwsoft-tiptap-popover .jwsoft-menu-label { margin-left: 10px; }
.jwsoft-tiptap-popover .jwsoft-color-grid { padding-inline: 6px; flex-wrap: wrap; }
.jwsoft-tiptap-popover .jwsoft-color-grid [data-editor-command] { width: 32px; padding: 5px; justify-content: center; }
.jwsoft-tiptap-popover[data-presentation=sheet] { max-width: none; border-radius: 16px; padding: 12px 12px max(12px, env(safe-area-inset-bottom)); overscroll-behavior: contain; }
.jwsoft-tiptap-popover[data-presentation=sheet]::backdrop { background: #0f172a45; }
.jwsoft-tiptap-popover[data-presentation=sheet] .jwsoft-popover-header { font-size: 14px; }
.jwsoft-tiptap-popover[data-presentation=sheet] .jwsoft-tiptap-tool { min-height: 44px; }
.jwsoft-toolbar-measure { position: fixed !important; left: -10000px !important; top: 0 !important; width: max-content !important; max-width: none !important; flex-wrap: nowrap !important; visibility: hidden !important; pointer-events: none !important; }
html.dark .jwsoft-popover-header, html.dark .jwsoft-menu-section { border-color: #394150; color: #adb7c6; }
.jwsoft-tiptap-dialog { box-sizing: border-box; position: fixed; inset: 0; margin: auto; padding: 0; width: min(640px, calc(100vw - 32px)); max-height: min(820px, calc(100dvh - 48px)); overflow: auto; border: 1px solid #e5e7eb; border-radius: 16px; background: #fff; color: #20242b; box-shadow: 0 24px 80px #0f172a40; font-family: inherit; }
.jwsoft-tiptap-dialog[open] { display: block; animation: jwsoft-reveal .16s ease-out; }
.jwsoft-tiptap-dialog::backdrop { background: #0f172a66; backdrop-filter: blur(3px); }
.jwsoft-dialog-compact { width: min(420px, calc(100vw - 32px)); }
.jwsoft-tiptap-dialog-header { position: sticky; top: 0; z-index: 2; margin: 0; padding: 18px 22px; border-bottom: 1px solid #edf0f4; background: inherit; }
.jwsoft-tiptap-dialog-header h2 { margin: 0; font-size: 17px; font-weight: 650; letter-spacing: -.02em; color: inherit; }
.jwsoft-tiptap-dialog-close { display: grid; place-items: center; width: 34px; height: 34px; min-height: 34px; padding: 0; background: transparent; border: 0; color: #667080; }
.jwsoft-tiptap-dialog-close:hover { background: #f1f4f8; }
.jwsoft-tiptap-dialog-form { display: grid; grid-template-columns: 1fr; padding: 22px; gap: 18px; }
.jwsoft-tiptap-field { gap: 7px; color: #475569; font-size: 12px; }
.jwsoft-tiptap-field input:not([type=checkbox]), .jwsoft-tiptap-field select { box-sizing: border-box; width: 100%; height: 40px; min-height: 40px; border: 1px solid #d8dee7; border-radius: 7px; background: #fff; padding: 8px 11px; color: #20242b; font: inherit; font-size: 14px; outline-offset: 2px; }
.jwsoft-tiptap-field-inline { flex-direction: row; align-self: start; gap: 8px; }
.jwsoft-tiptap-dialog-actions { display: flex; justify-content: flex-end; gap: 8px; grid-column: 1 / -1; padding-top: 14px; border-top: 1px solid #edf0f4; }
.jwsoft-tiptap-dialog-actions button, .jwsoft-tiptap-dialog-form > button { min-height: 40px; padding: 9px 16px; border-radius: 7px; font-size: 13px; font-weight: 550; }
.jwsoft-tiptap-dialog-primary { box-shadow: 0 1px 2px #1e40af20; }
.jwsoft-tiptap-dialog-primary:disabled { opacity: .5; cursor: wait; }
.jwsoft-dialog-tabs { display: flex; gap: 4px; padding: 4px; border-radius: 9px; background: #f1f4f8; }
.jwsoft-dialog-tabs button { flex: 1; border: 0; padding: 9px 12px; border-radius: 6px; background: transparent; color: #647084; font-size: 13px; cursor: pointer; }
.jwsoft-dialog-tabs button[aria-selected=true] { background: #fff; color: #20242b; box-shadow: 0 1px 3px #0f172a12; font-weight: 600; }
.jwsoft-upload-workspace, .jwsoft-image-url-panel { min-width: 0; }
.jwsoft-image-form [hidden], .jwsoft-tiptap-popover [hidden], .jwsoft-tiptap-toolbar [hidden] { display: none !important; }
.jwsoft-upload-dropzone { width: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 10px; padding: 34px 18px; border: 1.5px dashed #c8d1df; border-radius: 10px; background: #fafbfe; color: #556174; cursor: pointer; transition: background .15s, border-color .15s; }
.jwsoft-upload-dropzone .jwsoft-icon { width: 30px; height: 30px; color: #74829a; }
.jwsoft-upload-dropzone strong { font-size: 14px; font-weight: 550; color: #334155; }
.jwsoft-upload-dropzone span { font-size: 11px; color: #7b8595; text-align: center; }
.jwsoft-upload-dropzone:hover, .jwsoft-upload-dropzone[data-dragging=true] { background: #eff5ff; border-color: #2563eb; }
.jwsoft-upload-list { display: grid; gap: 8px; margin-top: 12px; }
.jwsoft-upload-list:empty { margin: 0; }
.jwsoft-upload-item { display: flex; align-items: center; gap: 12px; border: 1px solid #e5e9f0; border-radius: 9px; padding: 10px; }
.jwsoft-upload-item > img { width: 50px; height: 50px; object-fit: cover; border-radius: 6px; }
.jwsoft-upload-item > .jwsoft-icon { width: 50px; height: 50px; flex-shrink: 0; padding: 10px; color: #74829a; }
.jwsoft-upload-item > div { flex: 1; min-width: 0; }
.jwsoft-upload-item strong { display: block; overflow-wrap: anywhere; font-size: 13px; font-weight: 550; }
.jwsoft-upload-item span { display: block; margin-top: 4px; font-size: 13px; color: #556174; }
.jwsoft-upload-item[data-state=error] { border-color: #fca5a5; }
.jwsoft-upload-item[data-state=error] span { color: #b91c1c; }
.jwsoft-upload-item progress { display: block; width: 100%; height: 8px; margin-top: 7px; accent-color: #2563eb; }
.jwsoft-upload-item > button { display: grid; place-items: center; min-width: 32px; height: 32px; border: 0; border-radius: 6px; background: transparent; color: #64748b; cursor: pointer; }
.jwsoft-upload-item > button:hover { background: #f1f5f9; }
.jwsoft-image-preview { display: block; width: 100%; max-height: 240px; object-fit: contain; margin-top: 14px; border-radius: 8px; background: #f8fafc; }
.jwsoft-image-details { padding-top: 5px; }
.jwsoft-image-details summary { cursor: pointer; font-size: 12px; color: #596579; padding: 6px 0; }
.jwsoft-detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 14px; }
html.dark .jwsoft-tiptap-shell { --jw-surface: #171a20; --jw-muted: #252a33; --jw-border: #343b47; --jw-ink: #e5e9ef; --jw-subtle: #a2acba; }
html.dark .jwsoft-tiptap-dialog, html.dark .jwsoft-tiptap-popover { background: #1b2028; color: #e5e9ef; border-color: #394150; }
html.dark .jwsoft-tiptap-dialog-header { color: #e5e9ef; border-color: #394150; }
html.dark .jwsoft-tiptap-field { color: #b9c2d0; }
html.dark .jwsoft-tiptap-field input:not([type=checkbox]), html.dark .jwsoft-tiptap-field select { background: #242b35; color: #e5e9ef; border-color: #414b5b; }
html.dark .jwsoft-dialog-tabs, html.dark .jwsoft-upload-dropzone { background: #252c36; }
html.dark .jwsoft-dialog-tabs button[aria-selected=true] { background: #3a4351; color: #fff; }
html.dark .jwsoft-upload-dropzone strong { color: #d1d9e5; }
html.dark .jwsoft-upload-item { border-color: #414b5b; }
@keyframes jwsoft-reveal { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
@media (max-width: 640px) {
  .jwsoft-tiptap-toolbar { gap: 3px; padding: 5px; }
  .jwsoft-tiptap-tool-group { gap: 0; padding-right: 3px; }
  .jwsoft-tiptap-tool, .jwsoft-tiptap-select { height: 44px; min-height: 44px; }
  .jwsoft-tiptap-tool { min-width: 44px; }
  .jwsoft-tiptap-select { max-width: 84px; }
  .jwsoft-tiptap-editable { padding: 20px 16px; }
  .jwsoft-tiptap-dialog { width: calc(100vw - 16px); max-height: calc(100dvh - 24px); border-radius: 12px; }
  .jwsoft-tiptap-dialog-header { padding: 14px 16px; }
  .jwsoft-tiptap-dialog-form { padding: 16px; gap: 16px; }
  .jwsoft-tiptap-dialog-actions button, .jwsoft-tiptap-dialog-close, .jwsoft-upload-item > button { min-height: 44px; }
  .jwsoft-detail-grid { gap: 12px; }
  .jwsoft-tiptap-tool[data-tooltip]:hover::after { display: none; }
}
@media (prefers-reduced-motion: reduce) { .jwsoft-tiptap-dialog[open], .jwsoft-tiptap-popover:popover-open { animation: none; } .jwsoft-tiptap-tool, .jwsoft-upload-dropzone { transition: none; } }
${EDITOR_TOKEN_CSS}
.jwsoft-format-row { display: flex; align-items: center; justify-content: space-between; gap: 24px; font-size: 12px; color: #5d697b; }
.jwsoft-menu-label { margin: 8px 0 0; font-size: 11px; color: #798497; }
.jwsoft-color-grid { display: flex; gap: 4px; padding: 4px 0; }
.jwsoft-color-grid .jwsoft-tiptap-tool { border: 1px solid #e0e5ed; min-width: 32px; width: 32px; height: 32px; padding: 5px; }
.jwsoft-color-grid .jwsoft-tiptap-tool[aria-pressed=true] { outline: 2px solid #2563eb; outline-offset: 1px; }
.jwsoft-context-tools { position: fixed; inset: auto; margin: 0; padding: 5px; max-width: calc(100vw - 16px); box-sizing: border-box; border: 1px solid #dce2eb; border-radius: 10px; background: #fff; color: #334155; box-shadow: 0 5px 20px #172b4d26; }
.jwsoft-context-tools:popover-open { display: flex; flex-wrap: wrap; gap: 3px; align-items: center; width: max-content; max-width: min(590px, calc(100vw - 16px)); }
.jwsoft-context-tools .jwsoft-tiptap-select { max-width: 105px; }
.jwsoft-editor-footer { text-align: right; padding: 8px 16px; font-size: 11px; color: var(--jw-subtle, #8590a2); background: var(--jw-surface, #fff); border-top: 1px solid var(--jw-border, #edf0f4); }
.jwsoft-editor-fullscreen { position: fixed !important; inset: 12px !important; z-index: 9999; display: flex; flex-direction: column; margin: 0 !important; height: auto !important; max-height: none !important; }
.jwsoft-editor-fullscreen .jwsoft-tiptap-editor-frame { flex: 1; min-height: 0; overflow: auto; }
.jwsoft-editor-fullscreen .jwsoft-tiptap-editable { min-height: calc(100dvh - 200px) !important; max-height: none !important; }
.jwsoft-editor-fullscreen .jwsoft-tiptap-toolbar-region { position: sticky; top: 0; z-index: 5; }
.jwsoft-tiptap-editable .jwsoft-image-node { position: relative; margin-top: 18px; margin-bottom: 18px; }
.jwsoft-tiptap-editable .jwsoft-image-node img { display: block; width: 100%; height: auto; }
.jwsoft-image-resize { display: none; position: absolute; right: -6px; bottom: -6px; width: 18px; height: 18px; padding: 0; border: 2px solid #fff; border-radius: 5px; background: #2563eb; box-shadow: 0 0 0 1px #2563eb; cursor: ew-resize; touch-action: none; }
.jwsoft-image-node.ProseMirror-selectednode { outline: 2px solid #2563eb; outline-offset: 3px; }
.jwsoft-image-node.ProseMirror-selectednode .jwsoft-image-resize:not(:disabled), .jwsoft-image-node:focus-within .jwsoft-image-resize:not(:disabled) { display: block; }
.jwsoft-tiptap-editable .jwsoft-task-node { display: flex; align-items: flex-start; gap: 10px; padding-left: 0; }
.jwsoft-tiptap-editable .jwsoft-task-node::before { display: none; }
.jwsoft-task-node > input { flex: 0 0 auto; margin-top: 9px; width: 16px; height: 16px; accent-color: #2563eb; cursor: pointer; }
.jwsoft-task-content { flex: 1; min-width: 0; }
.jwsoft-task-content > p { margin: 4px 0; }
.jwsoft-search-status { font-size: 12px; color: #64748b; margin: 0; }
.jwsoft-video-file-name { font-size: 12px; color: #475569; overflow-wrap: anywhere; }
.jwsoft-media-form [hidden] { display: none !important; }
html.dark .jwsoft-context-tools { background: #222a36; border-color: #414b5b; color: #e5e9ef; }
html.dark .jwsoft-format-row { color: #bdc7d5; }
@media (max-width: 640px) {
 .jwsoft-context-tools:popover-open { gap: 0; }
 .jwsoft-context-tools .jwsoft-tiptap-tool { width: 40px; }
 .jwsoft-tiptap-popover .jwsoft-color-grid .jwsoft-tiptap-tool { min-width: 44px; min-height: 44px; width: 44px; }
 .jwsoft-editor-fullscreen { inset: 0 !important; border-radius: 0; }
 .jwsoft-image-resize { width: 24px; height: 24px; }
 .jwsoft-tiptap-dialog-actions { flex-wrap: wrap; }
}
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
