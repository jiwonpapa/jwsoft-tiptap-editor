import { editorContainerId } from "@/editor/content";
import { editorRegistry } from "@/editor/editorRegistry";
import { vi } from "vitest";

export function resetEditorHandlerFixture(): void {
  editorRegistry.destroyAll();
  document.body.replaceChildren();
  document.head
    .querySelectorAll("[id^='jwsoft-tiptap-']")
    .forEach((node) => node.remove());
  window.__SirsoftCkeditor5 = undefined;
  window.CKEDITOR = undefined;
  window.G7Core = {
    locale: { current: () => "ko", supported: () => ["ko", "en"] },
    state: {
      getLocal: () => ({ form: { content_mode: "html" } }),
      setLocal: vi.fn(),
    },
  };
}

export function addContainer(name = "content"): HTMLElement {
  const container = document.createElement("div");
  container.id = editorContainerId(name);
  document.body.appendChild(container);
  return container;
}
