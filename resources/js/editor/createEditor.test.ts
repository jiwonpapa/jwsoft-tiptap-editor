import { createEditor } from "@/editor/createEditor";

describe("Tiptap policy schema", () => {
  it("preserves an existing link without adding target or rel defaults", () => {
    const mount = document.createElement("div");
    document.body.appendChild(mount);
    const editor = createEditor({
      element: mount,
      content: '<p><a href="https://example.com">링크</a></p>',
      placeholder: "",
      editable: false,
      onUpdate: vi.fn(),
    });

    expect(editor.getHTML()).toBe(
      '<p><a href="https://example.com">링크</a></p>',
    );
    editor.destroy();
    mount.remove();
  });
});
