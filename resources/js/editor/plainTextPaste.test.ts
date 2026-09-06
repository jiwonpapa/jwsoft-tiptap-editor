import { afterEach, expect, it, vi } from "vitest";
import type { Editor } from "@tiptap/core";
import { createEditor } from "./createEditor";
import { insertPlainText } from "./plainTextPaste";

let editor: Editor;
const embed = vi.fn(() => true);
function setup(content = "<p></p>") {
  const element = document.body.appendChild(document.createElement("div"));
  editor = createEditor({
    element,
    content,
    editable: true,
    placeholder: "",
    onUpdate() {},
    onPlainUrlPasted: embed,
  });
}
function paste(plain: string, html: string) {
  const event = new Event("paste", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "clipboardData", {
    value: {
      files: [],
      getData: (type: string) => (type === "text/html" ? html : plain),
    },
  });
  editor.view.dom.dispatchEvent(event);
}
afterEach(() => {
  editor?.destroy();
  document.body.replaceChildren();
  vi.clearAllMocks();
});

it("keeps multiline text, escapes HTML, and undoes in one step", () => {
  setup();
  expect(
    insertPlainText(
      editor.view,
      "<img src=x onerror=alert(1)>\r\n둘째\n\n넷째",
    ),
  ).toBe(true);
  expect(editor.getHTML()).toBe(
    "<p>&lt;img src=x onerror=alert(1)&gt;</p><p>둘째</p><p></p><p>넷째</p>",
  );
  editor.commands.undo();
  expect(editor.isEmpty).toBe(true);
  editor.commands.redo();
  expect(editor.getText()).toContain("넷째");
});

it("replaces selected text without copying active marks or auto-linking", () => {
  setup("<p><strong>선택</strong></p>");
  editor.commands.setTextSelection({ from: 1, to: 3 });
  insertPlainText(editor.view, "https://example.com");
  expect(editor.getHTML()).toBe("<p>https://example.com</p>");
  expect(embed).not.toHaveBeenCalled();
});

it("uses literal newlines inside code blocks", () => {
  setup("<pre><code>기존</code></pre>");
  editor.commands.setTextSelection({ from: 1, to: 3 });
  insertPlainText(editor.view, "a\nb");
  expect(editor.getHTML()).toContain("<code>a\nb</code>");
});

it("Shift paste ignores rich clipboard HTML and external URL conversion", () => {
  setup();
  editor.view.dom.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "v",
      shiftKey: true,
      ctrlKey: true,
      bubbles: true,
    }),
  );
  paste("https://example.com", '<strong style="color:red">rich</strong>');
  expect(editor.getHTML()).toBe("<p>https://example.com</p>");
  expect(embed).not.toHaveBeenCalled();
});

it("ordinary paste and Shift+Insert still preserve permitted formatting", () => {
  setup();
  editor.view.dom.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "Insert",
      shiftKey: true,
      bubbles: true,
    }),
  );
  paste("글자", '<strong style="color:red" onclick="evil()">글자</strong>');
  expect(editor.getHTML()).toBe("<p><strong>글자</strong></p>");
});

it("rejects empty and read-only operations", () => {
  setup();
  expect(insertPlainText(editor.view, "")).toBe(false);
  editor.setEditable(false);
  expect(insertPlainText(editor.view, "불가")).toBe(false);
  expect(editor.isEmpty).toBe(true);
});
