import { createEditor } from "@/editor/createEditor";

describe("Tiptap policy schema", () => {
  function mountEditor(content: string, editable = true) {
    const mount = document.createElement("div");
    document.body.appendChild(mount);
    const editor = createEditor({
      element: mount,
      content,
      placeholder: "",
      editable,
      onUpdate: vi.fn(),
    });
    return { editor, mount };
  }

  it("preserves an existing link without adding target or rel defaults", () => {
    const { editor, mount } = mountEditor(
      '<p><a href="https://example.com">링크</a></p>',
      false,
    );

    expect(editor.getHTML()).toBe(
      '<p><a href="https://example.com">링크</a></p>',
    );
    editor.destroy();
    mount.remove();
  });

  it("applies an inline mark only to the selected text range", () => {
    const { editor, mount } = mountEditor("<p>가나다</p>");
    editor.commands.setTextSelection({ from: 2, to: 3 });
    editor.commands.toggleBold();

    expect(editor.getHTML()).toBe("<p>가<strong>나</strong>다</p>");
    editor.destroy();
    mount.remove();
  });

  it("writes only declared class tokens and preserves token categories", () => {
    const { editor, mount } = mountEditor("<p>문단</p>");
    editor.commands.setTextSelection(2);

    expect(editor.commands.setClassToken("alignment", "jw-align-center")).toBe(
      true,
    );
    expect(editor.commands.setClassToken("spacing", "jw-space-relaxed")).toBe(
      true,
    );
    expect(editor.commands.setClassToken("alignment", "jw-align-right")).toBe(
      true,
    );
    expect(editor.getHTML()).toBe(
      '<p class="jw-align-right jw-space-relaxed">문단</p>',
    );
    expect(editor.getHTML()).not.toContain("style=");

    editor.destroy();
    mount.remove();
  });

  it("rejects undeclared class tokens", () => {
    const { editor, mount } = mountEditor("<p>문단</p>");
    editor.commands.setTextSelection(2);

    expect(editor.commands.setClassToken("alignment", "evil-class")).toBe(
      false,
    );
    expect(editor.getHTML()).toBe("<p>문단</p>");
    editor.destroy();
    mount.remove();
  });

  it("reports policy-safe paste when the editor schema must normalize it", () => {
    const mount = document.createElement("div");
    document.body.appendChild(mount);
    const onPasteSanitized = vi.fn();
    const editor = createEditor({
      element: mount,
      content: "<p></p>",
      placeholder: "",
      editable: true,
      onUpdate: vi.fn(),
      onPasteSanitized,
    });
    const event = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "clipboardData", {
      value: {
        getData: (type: string) =>
          type === "text/html"
            ? "<table><thead><tr><th><p>머리</p></th></tr></thead></table>"
            : "",
      },
    });
    editor.view.dom.dispatchEvent(event);

    expect(onPasteSanitized).toHaveBeenCalledOnce();
    expect(editor.getHTML()).not.toContain("<thead>");
    editor.destroy();
    mount.remove();
  });
});
