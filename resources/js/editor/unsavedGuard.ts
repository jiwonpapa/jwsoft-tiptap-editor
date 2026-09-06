import type { Editor } from "@tiptap/core";
import type { G7CoreApi } from "@/g7/types";

/** Native reload/close guard only. G7 owns SPA cancellation and save success. */
export function installUnsavedGuard(
  editor: Editor,
  core?: G7CoreApi,
): () => void {
  const element = editor.view.dom;
  const window = element.ownerDocument.defaultView;
  if (!window) return () => {};
  const route = window.location.href;
  let baseline = editor.getHTML();
  let hostDirty = core?.state?.getLocal?.().hasChanges === true;
  let listening = false;
  let disposed = false;
  const active = () =>
    !disposed &&
    !editor.isDestroyed &&
    editor.isEditable &&
    element.isConnected &&
    window.location.href === route;
  const dirty = () => hostDirty || editor.getHTML() !== baseline;
  const beforeUnload = (event: BeforeUnloadEvent) => {
    if (!active() || !dirty()) return;
    event.preventDefault();
    event.returnValue = "";
  };
  const refresh = () => {
    const required = active() && dirty();
    if (required === listening) return;
    listening = required;
    if (required) window.addEventListener("beforeunload", beforeUnload);
    else window.removeEventListener("beforeunload", beforeUnload);
  };
  const hostChanged = () => {
    if (!active()) return;
    const local = core?.state?.getLocal?.();
    // Only an observed dirty -> clean host transition acknowledges a save.
    // Clicking submit, an HTTP failure or the initial debounce never does.
    if (hostDirty && local?.hasChanges === false && local.isSaving !== true) {
      baseline = editor.getHTML();
    }
    hostDirty = local?.hasChanges === true;
    refresh();
  };
  const unsubscribe = core?.state?.subscribe?.(hostChanged);
  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    window.removeEventListener("beforeunload", beforeUnload);
    unsubscribe?.();
    editor.off("update", refresh);
    editor.off("destroy", cleanup);
  };
  editor.on("update", refresh);
  editor.on("destroy", cleanup);
  refresh();
  return cleanup;
}
