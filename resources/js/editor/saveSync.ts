import type { Editor } from "@tiptap/core";

/**
 * Publish a dirty, self-managed field before the host handles a save action.
 * G7 also uses type=button actions outside native forms. An unrelated async
 * action can restore an older form snapshot after our input debounce settled.
 * Use the normal public setLocal sync callback, never patch the host dispatcher
 * or intercept its request. G7 flushes this pending write before its action.
 */
export function installEditorSaveSync(
  editor: Editor,
  sync: () => void,
): () => void {
  const element = editor.view.dom;
  const document = element.ownerDocument;
  const location = document.defaultView?.location;
  const route = location?.href;
  const form = element.closest("form");
  const dialog = element.closest('dialog, [role="dialog"]');
  let dirty = false;
  let disposed = false;
  const updated = () => {
    if (editor.isEditable) dirty = true;
  };
  const publish = (event: Event) => {
    if (
      disposed ||
      !dirty ||
      editor.isDestroyed ||
      !editor.isEditable ||
      !element.isConnected ||
      location?.href !== route ||
      !(event.target instanceof Element)
    )
      return;
    const target = event.target;
    // Toolbar/embedded controls and unrelated dialogs are not host save actions.
    if (
      target.closest(".jwsoft-tiptap-wrapper") ||
      target.closest('dialog, [role="dialog"]') !== dialog ||
      target.closest("form") !== form
    )
      return;
    if (
      event.type === "click" &&
      !target.closest('button, input[type="submit"], input[type="image"]')
    )
      return;
    sync();
  };
  // Capture precedes G7/React's action handler and debounce flush. Do not cancel,
  // delay, submit or change any host-owned field (title, slug, product price).
  document.addEventListener("click", publish, true);
  document.addEventListener("submit", publish, true);
  editor.on("update", updated);
  const cleanup = () => {
    disposed = true;
    document.removeEventListener("click", publish, true);
    document.removeEventListener("submit", publish, true);
    editor.off("update", updated);
    editor.off("destroy", cleanup);
  };
  editor.on("destroy", cleanup);
  return cleanup;
}
