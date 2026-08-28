import { destroyEditorHandler } from "@/handlers/destroyEditor";
import { initEditorHandler } from "@/handlers/initEditor";
import { injectContentStylesHandler } from "@/handlers/injectContentStyles";
import {
  registerHandlers,
  startHandlerRegistration,
} from "@/integration/registerHandlers";
import { editorRegistry } from "@/editor/editorRegistry";
import type { HandlerMap } from "@/g7/types";

export const JWSoftTiptapEditorBuild = Object.freeze({
  identifier: "jwsoft-tiptap-editor",
  stage: "board-canonical-write-alpha",
  version: "0.1.0-alpha.3",
  writeEnabled: true,
});

export const handlerMap: HandlerMap = {
  initEditor: initEditorHandler,
  destroyEditor: destroyEditorHandler,
  injectContentStyles: injectContentStylesHandler,
};

export function initPlugin(): void {
  startHandlerRegistration(handlerMap);
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  initPlugin();
  window.JWSoftTiptapEditorBuild = JWSoftTiptapEditorBuild;
  window.__JWSoftTiptapEditor = {
    identifier: JWSoftTiptapEditorBuild.identifier,
    handlers: Object.keys(handlerMap),
    initPlugin,
    registerHandlers: () => registerHandlers(handlerMap),
    getInstanceCount: () => editorRegistry.size,
  };
}
