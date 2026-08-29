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

  it("preserves legacy images and round-trips policy image figures", () => {
    const { editor, mount } = mountEditor(
      '<img src="/legacy.webp" alt="기존"><figure class="jw-image jw-image-align-center jw-image-size-75"><img src="/new.webp" alt="신규"><figcaption>대표 이미지</figcaption></figure>',
    );

    expect(editor.getHTML()).toContain(
      '<img src="/legacy.webp" alt="기존"><figure class="jw-image jw-image-align-center jw-image-size-75">',
    );
    expect(editor.getHTML()).toContain("<figcaption>대표 이미지</figcaption>");
    expect(editor.getHTML()).not.toContain("style=");
    editor.destroy();
    mount.remove();
  });

  it("escapes image captions stored as node attributes", () => {
    const { editor, mount } = mountEditor("<p></p>");
    editor.commands.insertContent({
      type: "image",
      attrs: {
        src: "/safe.webp",
        alt: "안전",
        caption: "<script>alert(1)</script>",
        jwClassTokens: "jw-image jw-image-align-center jw-image-size-100",
      },
    });

    expect(editor.getHTML()).toContain(
      "<figcaption>&lt;script&gt;alert(1)&lt;/script&gt;</figcaption>",
    );
    expect(editor.getHTML()).not.toContain("<script>");
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

  it("keeps a sanitized paste reversible through undo and redo", () => {
    const { editor, mount } = mountEditor("<p>한글 입력</p>");
    editor.commands.setTextSelection(editor.state.doc.content.size - 1);
    const event = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "clipboardData", {
      value: {
        files: [],
        getData: (type: string) =>
          type === "text/html"
            ? '<strong style="color:red">붙여넣기</strong>'
            : "붙여넣기",
      },
    });
    editor.view.dom.dispatchEvent(event);

    expect(editor.getHTML()).toBe("<p>한글 입력<strong>붙여넣기</strong></p>");
    expect(editor.commands.undo()).toBe(true);
    expect(editor.getHTML()).toBe("<p>한글 입력</p>");
    expect(editor.commands.redo()).toBe(true);
    expect(editor.getHTML()).toBe("<p>한글 입력<strong>붙여넣기</strong></p>");
    expect(editor.getHTML()).not.toContain("style=");
    editor.destroy();
    mount.remove();
  });

  it("routes dropped and pasted image files to configured upload handlers", () => {
    const mount = document.createElement("div");
    document.body.appendChild(mount);
    const onImageFilesDropped = vi.fn();
    const onImageFilesPasted = vi.fn();
    const editor = createEditor({
      element: mount,
      content: "<p></p>",
      placeholder: "",
      editable: true,
      onUpdate: vi.fn(),
      onImageFilesDropped,
      onImageFilesPasted,
    });
    const image = new File(["proof"], "proof.png", { type: "image/png" });

    const drop = new Event("drop", { bubbles: true, cancelable: true });
    Object.defineProperty(document, "elementFromPoint", {
      configurable: true,
      value: () => editor.view.dom,
    });
    Object.defineProperty(drop, "dataTransfer", {
      value: { files: [image], getData: () => "", types: ["Files"] },
    });
    editor.view.dom.dispatchEvent(drop);

    const paste = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(paste, "clipboardData", {
      value: { files: [image], getData: () => "" },
    });
    editor.view.dom.dispatchEvent(paste);

    expect(onImageFilesDropped).toHaveBeenCalledWith(
      [image],
      expect.any(Number),
    );
    expect(onImageFilesPasted).toHaveBeenCalledWith(
      [image],
      expect.any(Number),
    );
    expect(drop.defaultPrevented).toBe(true);
    expect(paste.defaultPrevented).toBe(true);
    editor.destroy();
    mount.remove();
  });
});
