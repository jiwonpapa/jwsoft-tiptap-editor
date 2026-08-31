import type { Editor } from "@tiptap/core";
import { editorText } from "@/editor/locale";
import { normalizeEmptyEditorHtml } from "@/editor/meaningfulContent";
import { sanitizeClientHtml } from "@/policy/runtimePolicy";

/**
 * Fallback for G7 forms whose save action exists only on a type=button control.
 * Run after framework handlers, and never take over a configured submit action.
 */
export function installFormSubmitGuard(
  editor: Editor,
  status: HTMLElement,
  locale: string,
): () => void {
  const form = editor.view.dom.closest("form");
  if (!form) return () => {};
  const view = form.ownerDocument.defaultView;
  if (!view) return () => {};
  let composing = false;
  let ownsStatus = false;
  const compositionStart = () => {
    composing = true;
  };
  const compositionEnd = () => {
    composing = false;
  };
  const clear = () => {
    if (!ownsStatus) return;
    ownsStatus = false;
    status.textContent = "";
    status.dataset.tone = "neutral";
    status.setAttribute("role", "status");
    if (!editor.isDestroyed) editor.view.dom.removeAttribute("aria-invalid");
  };
  const submit = (event: Event) => {
    if (
      event.target !== form ||
      event.defaultPrevented ||
      (event as SubmitEvent).submitter ||
      form.hasAttribute("action") ||
      form.method.toLowerCase() !== "get" ||
      editor.isDestroyed ||
      !editor.view.dom.isConnected
    )
      return;
    event.preventDefault();
    if (composing) return;
    const empty = !normalizeEmptyEditorHtml(
      sanitizeClientHtml(editor.getHTML()),
    );
    if (editor.isEditable) editor.commands.focus();
    ownsStatus = true;
    status.setAttribute("role", empty ? "alert" : "status");
    status.dataset.tone = empty ? "warning" : "neutral";
    status.textContent = editorText(
      locale,
      !editor.isEditable
        ? "본문의 편집 가능 여부를 먼저 확인해 주세요."
        : empty
          ? "본문을 입력해 주세요."
          : "본문 편집 후 등록 버튼을 눌러 주세요.",
    );
    if (editor.isEditable) {
      if (empty) editor.view.dom.setAttribute("aria-invalid", "true");
    }
  };
  // Window bubble follows the host framework's form/root handlers.
  view.addEventListener("submit", submit);
  form.addEventListener("compositionstart", compositionStart);
  form.addEventListener("compositionend", compositionEnd);
  editor.on("update", clear);
  const destroy = () => {
    view.removeEventListener("submit", submit);
    form.removeEventListener("compositionstart", compositionStart);
    form.removeEventListener("compositionend", compositionEnd);
    editor.off("update", clear);
    editor.off("destroy", destroy);
    clear();
  };
  editor.on("destroy", destroy);
  return destroy;
}
