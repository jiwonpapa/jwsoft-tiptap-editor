/** Accept sanitized HTML only; keep this empty-value rule aligned with EditorContent.php. */
export function normalizeEmptyEditorHtml(html: string): string {
  const document = new DOMParser().parseFromString(html, "text/html");
  const text = (document.body.textContent ?? "").replace(
    /[\p{Z}\p{C}\uFE00-\uFE0F]/gu,
    "",
  );
  return text || document.body.querySelector('img[src]:not([src=""])')
    ? html
    : "";
}
