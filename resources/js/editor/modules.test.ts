import {
  BUILTIN_EDITOR_MODULES,
  createEditorExtensions,
} from "@/editor/modules";
import { createEditor } from "@/editor/createEditor";

describe("bundled editor modules", () => {
  it("has explicit unique module IDs and independent configured extensions", () => {
    expect(BUILTIN_EDITOR_MODULES).toEqual([
      "writing",
      "image",
      "table",
      "media",
      "social",
    ]);
    expect(Object.isFrozen(BUILTIN_EDITOR_MODULES)).toBe(true);
    const first = createEditorExtensions({
      placeholder: "첫 글",
      mediaPlayback: { loadMode: "click", autoplay: false },
    });
    const second = createEditorExtensions({ placeholder: "다음 글" });
    expect(new Set(first.map((extension) => extension.name)).size).toBe(
      first.length,
    );
    expect(
      first.find((extension) => extension.name === "placeholder")!.options
        .placeholder,
    ).toBe("첫 글");
    expect(
      second.find((extension) => extension.name === "placeholder")!.options
        .placeholder,
    ).toBe("다음 글");
  });
  it("preserves existing media and class-token HTML across the modular schema", () => {
    const mount = document.createElement("div");
    document.body.append(mount);
    const html =
      '<h2>문서</h2><p><span class="jw-color-blue">색상</span></p><figure class="jw-media jw-media-youtube"><a class="jw-media-source" href="https://www.youtube.com/watch?v=dQw4w9WgXcQ">Video</a></figure><p></p>';
    const editor = createEditor({
      element: mount,
      content: html,
      editable: false,
      placeholder: "",
      onUpdate: () => undefined,
    });
    expect(editor.getHTML()).toContain('class="jw-color-blue"');
    expect(editor.getHTML()).toContain("dQw4w9WgXcQ");
    expect(editor.getHTML()).not.toContain("<iframe");
    expect(editor.getHTML()).not.toContain("<script");
    editor.destroy();
    mount.remove();
  });
});
