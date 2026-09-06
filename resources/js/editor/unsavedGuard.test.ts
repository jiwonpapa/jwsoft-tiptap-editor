import { afterEach, expect, it, vi } from "vitest";
import type { Editor } from "@tiptap/core";
import { createEditor } from "./createEditor";
import { installUnsavedGuard } from "./unsavedGuard";

let editor: Editor;
let changed: () => void;
let local: Record<string, unknown>;
const unsubscribe = vi.fn();
function setup(initialDirty = false) {
  local = { hasChanges: initialDirty, isSaving: false };
  const element = document.body.appendChild(document.createElement("div"));
  editor = createEditor({
    element,
    content: "<p>원문</p>",
    editable: true,
    placeholder: "",
    onUpdate() {},
  });
  return installUnsavedGuard(editor, {
    state: {
      getLocal: () => local,
      subscribe: (listener) => {
        changed = listener;
        return unsubscribe;
      },
    },
  });
}
function warns() {
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}
afterEach(() => {
  editor?.destroy();
  document.body.replaceChildren();
  vi.clearAllMocks();
});

it("warns only after a document edit, before the host debounce, and clears on undo", () => {
  setup();
  expect(warns()).toBe(false);
  editor.setEditable(true);
  expect(warns()).toBe(false);
  editor.commands.insertContent("변경");
  expect(warns()).toBe(true);
  editor.commands.undo();
  expect(warns()).toBe(false);
});

it("keeps warning during saving and failure, clearing only on host acknowledgement", () => {
  setup();
  editor.commands.insertContent("변경");
  changed();
  expect(warns()).toBe(true);
  local = { hasChanges: true, isSaving: true };
  changed();
  expect(warns()).toBe(true);
  local = { hasChanges: true, isSaving: false };
  changed();
  expect(warns()).toBe(true);
  local = { hasChanges: false, isSaving: false };
  changed();
  expect(warns()).toBe(false);
  editor.commands.insertContent("추가");
  expect(warns()).toBe(true);
});

it("protects host dirty state after a locale remount without storing content", () => {
  setup(true);
  expect(warns()).toBe(true);
  expect(local).toEqual({ hasChanges: true, isSaving: false });
});

it("ignores read-only, detached and replaced routes", () => {
  setup();
  editor.commands.insertContent("변경");
  editor.setEditable(false);
  expect(warns()).toBe(false);
  editor.setEditable(true);
  const route = window.location.href;
  window.history.pushState({}, "", "#other");
  expect(warns()).toBe(false);
  window.history.replaceState({}, "", route);
  expect(warns()).toBe(true);
  editor.view.dom.remove();
  expect(warns()).toBe(false);
});

it("unsubscribes and removes listeners on destroy or repeated cleanup", () => {
  const cleanup = setup();
  editor.commands.insertContent("변경");
  cleanup();
  cleanup();
  editor.destroy();
  expect(warns()).toBe(false);
  expect(unsubscribe).toHaveBeenCalledOnce();
});
