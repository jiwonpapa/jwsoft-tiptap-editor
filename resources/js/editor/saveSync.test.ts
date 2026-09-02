import { afterEach, describe, expect, it, vi } from "vitest";
import { createEditor } from "./createEditor";
import { installEditorSaveSync } from "./saveSync";
import type { Editor } from "@tiptap/core";

const editors: Editor[] = [];
afterEach(() => {
  editors.splice(0).forEach((editor) => editor.destroy());
  document.body.replaceChildren();
});
function setup(withForm = false) {
  document.body.innerHTML = `${withForm ? "<form>" : "<section>"}<div class="jwsoft-tiptap-wrapper"><button id="toolbar" type="button">Format</button><div id="editor"></div></div><button id="save" type="button"><span>Save</span></button>${withForm ? "</form>" : "</section>"}<form id="other"><button type="button">Other</button></form><dialog open><button type="button">Modal</button></dialog>`;
  const editor = createEditor({
    element: document.querySelector<HTMLElement>("#editor")!,
    content: "<p>Original</p>",
    editable: true,
    placeholder: "",
    onUpdate() {},
  });
  editors.push(editor);
  const sync = vi.fn();
  const cleanup = installEditorSaveSync(editor, sync);
  const save = document.querySelector<HTMLButtonElement>("#save")!;
  return { editor, sync, cleanup, save };
}
describe("self-managed content save boundary", () => {
  it.each([false, true])(
    "publishes dirty content before the host action (form=%s)",
    (form) => {
      const { editor, sync, save } = setup(form);
      editor.commands.setContent("<p>New body</p>");
      const host = vi.fn((event: Event) => {
        expect(sync).toHaveBeenCalledOnce();
        expect(event.defaultPrevented).toBe(false);
      });
      save.addEventListener("click", host);
      save.querySelector("span")!.click();
      expect(host).toHaveBeenCalledOnce();
    },
  );
  it("does not rewrite untouched, read-only or detached editor content", () => {
    const { editor, sync, save } = setup();
    save.click();
    editor.commands.setContent("<p>Dirty</p>");
    editor.setEditable(false);
    save.click();
    editor.setEditable(true);
    editor.view.dom.remove();
    save.click();
    expect(sync).not.toHaveBeenCalled();
  });
  it("ignores toolbar buttons, unrelated dialogs, text clicks and other forms", () => {
    const { editor, sync } = setup(true);
    editor.commands.clearContent();
    for (const selector of [
      "#toolbar",
      "dialog button",
      "#other button",
      ".tiptap",
    ])
      document.querySelector<HTMLElement>(selector)!.click();
    expect(sync).not.toHaveBeenCalled();
  });
  it("synchronizes intentional deletion and native submit without taking it over", () => {
    const { editor, sync } = setup(true);
    editor.commands.clearContent();
    const event = new Event("submit", { bubbles: true, cancelable: true });
    document.querySelector("form")!.dispatchEvent(event);
    expect(sync).toHaveBeenCalledOnce();
    expect(event.defaultPrevented).toBe(false);
  });
  it("does not publish the old document after a SPA route change", () => {
    const { editor, sync, save } = setup();
    editor.commands.setContent("<p>Dirty</p>");
    const route = window.location.href;
    window.history.pushState({}, "", "#another-document");
    save.click();
    window.history.replaceState({}, "", route);
    expect(sync).not.toHaveBeenCalled();
  });
  it("removes its capture listeners on cleanup", () => {
    const { editor, sync, cleanup, save } = setup();
    editor.commands.setContent("<p>Dirty</p>");
    cleanup();
    save.click();
    expect(sync).not.toHaveBeenCalled();
  });
});
