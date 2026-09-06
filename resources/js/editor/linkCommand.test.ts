import { afterEach, expect, it } from "vitest";
import type { Editor } from "@tiptap/core";
import { createEditor } from "./createEditor";
import { applyEditorLink } from "./linkCommand";

let editor: Editor;
function setup(content = "<p></p>") {
  const element = document.body.appendChild(document.createElement("div"));
  editor = createEditor({
    element,
    content,
    editable: true,
    placeholder: "",
    onUpdate() {},
  });
  return editor;
}
const input = {
  href: "https://example.com",
  text: "",
  title: "",
  newWindow: true,
};
afterEach(() => {
  editor?.destroy();
  document.body.replaceChildren();
});

it("inserts an address at an empty cursor, with undo and no inherited link", () => {
  setup();
  expect(applyEditorLink(editor, input)).toBe(true);
  expect(editor.getText()).toBe(input.href);
  expect(editor.getHTML()).toContain('rel="noopener noreferrer"');
  editor.commands.insertContent(" after");
  expect(editor.getHTML()).toContain("</a> after");
  editor.commands.undo();
  expect(editor.getText()).toBe("");
});

it("preserves selected formatting and edits a link without duplicating text", () => {
  setup("<p><strong>선택</strong> 뒤</p>");
  editor.commands.setTextSelection({ from: 1, to: 3 });
  applyEditorLink(editor, input);
  expect(editor.getHTML()).toContain("<strong>");
  expect(editor.getText()).toBe("선택 뒤");
  editor.commands.setTextSelection(2);
  applyEditorLink(editor, { ...input, href: "/updated", title: "제목" });
  expect(editor.getText()).toBe("선택 뒤");
  expect(editor.getHTML()).toContain('href="/updated"');
  expect(editor.getHTML()).not.toContain(input.href);
});

it("treats display text as literal text, never as HTML", () => {
  setup();
  applyEditorLink(editor, { ...input, text: '<img src=x onerror="alert(1)">' });
  expect(editor.getText()).toBe('<img src=x onerror="alert(1)">');
  expect(
    editor.view.dom.querySelector("img,script,[style],[onerror]"),
  ).toBeNull();
});

it.each(["javascript:alert(1)", "data:text/html,test", "//evil.example"])(
  "rejects unsafe URL %s",
  (href) => {
    setup();
    expect(applyEditorLink(editor, { ...input, href })).toBe(false);
    expect(editor.isEmpty).toBe(true);
  },
);

it("does not modify read-only content", () => {
  setup();
  editor.setEditable(false);
  expect(applyEditorLink(editor, input)).toBe(false);
  expect(editor.isEmpty).toBe(true);
});
