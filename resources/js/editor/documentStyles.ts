// Shared document presentation. Editor chrome and transient node controls stay
// in editorStyles; saved HTML needs no extra presentation attributes.
const root = ":is(.jwsoft-tiptap-editable, .jwsoft-tiptap-content)";

export const DOCUMENT_CSS = `
${root} { --jw-document-ink: #20242b; --jw-document-muted: #606978; --jw-document-border: #cbd5e1; color: var(--jw-document-ink); font-size: 16px; line-height: 1.75; overflow-wrap: anywhere; }
html.dark ${root} { --jw-document-ink: #e5e9ef; --jw-document-muted: #a2acba; --jw-document-border: #414b5b; }
${root} > :first-child { margin-top: 0; }
${root} p { margin-block: .55em; }
${root} h2, ${root} h3, ${root} h4 { line-height: 1.3; letter-spacing: -.02em; margin: 1.4em 0 .5em; font-weight: 650; }
${root} h2 { font-size: 1.65em; }
${root} h3 { font-size: 1.35em; }
${root} h4 { font-size: 1.15em; }
${root} blockquote { border-inline-start: 3px solid var(--jw-document-border); margin: 1em 0; padding: .25em 1.1em; color: var(--jw-document-muted); }
${root} ul { list-style: disc; padding-inline-start: 2rem; }
${root} ol { list-style: decimal; padding-inline-start: 2rem; }
${root} ul.jw-task-list { list-style: none; padding-inline-start: 0; }
${root} .jw-task-checked > :is(p, .jwsoft-task-content) { color: var(--jw-document-muted); text-decoration: line-through; }
${root} :where(a:not([class])) { color: #1d4ed8; text-decoration: underline; }
html.dark ${root} :where(a:not([class])) { color: #93c5fd; }
${root} pre { overflow-x: auto; border-radius: .375rem; background: #111827; color: #f9fafb; padding: .75rem; }
${root} hr { border: 0; border-block-start: 1px solid var(--jw-document-border); margin-block: 1.5em; }
${root} table { width: 100%; border-collapse: collapse; }
${root} th, ${root} td { min-width: 4rem; border: 1px solid var(--jw-document-border); padding: .5rem; vertical-align: top; }
${root} img { max-width: 100%; height: auto; }
`;
