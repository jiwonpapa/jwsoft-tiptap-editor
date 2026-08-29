import { editorRegistry } from "@/editor/editorRegistry";

let observedDocument: Document | undefined;
let observedWindow: Window | undefined;
let observer: MutationObserver | undefined;

function handlePageHide(event: PageTransitionEvent): void {
  if (!event.persisted) editorRegistry.destroyAll();
}

export function stopEditorLifecycleCleanup(): void {
  observer?.disconnect();
  observedWindow?.removeEventListener("pagehide", handlePageHide);
  observer = undefined;
  observedWindow = undefined;
  observedDocument = undefined;
}

export function startEditorLifecycleCleanup(
  targetDocument: Document = document,
): void {
  if (observer && observedDocument === targetDocument) return;
  stopEditorLifecycleCleanup();

  const targetWindow = targetDocument.defaultView;
  if (!targetWindow || !targetDocument.documentElement) return;

  observedDocument = targetDocument;
  observedWindow = targetWindow;
  observer = new targetWindow.MutationObserver(() => {
    editorRegistry.destroyDisconnected();
  });
  observer.observe(targetDocument.documentElement, {
    childList: true,
    subtree: true,
  });
  targetWindow.addEventListener("pagehide", handlePageHide);
}
