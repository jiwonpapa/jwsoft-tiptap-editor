import manifest from "../../../plugin.json";
import { createEditor } from "@/editor/createEditor";
import { createEditorFooter } from "@/editor/editorFooter";
import { initEditorHandler } from "@/handlers/initEditor";
import { editorRegistry } from "@/editor/editorRegistry";
import type { Editor } from "@tiptap/core";

describe("jw-editor product footer", () => {
  const editors: Editor[] = [];
  beforeEach(() => {
    window.__SirsoftCkeditor5 = undefined;
    window.CKEDITOR = undefined;
    window.G7Core = {
      locale: { current: () => "ko", supported: () => ["ko", "en"] },
      state: { getLocal: () => ({}), setLocal: vi.fn() },
    };
    document.body.replaceChildren();
  });
  afterEach(() => {
    editors.forEach((editor) => {
      if (!editor.isDestroyed) editor.destroy();
    });
    editors.length = 0;
    editorRegistry.destroyAll();
    vi.restoreAllMocks();
  });
  function setup(locale = "ko") {
    const mount = document.createElement("div");
    document.body.append(mount);
    const changed = vi.fn();
    const editor = createEditor({
      element: mount,
      content: "<p>본문</p>",
      editable: true,
      placeholder: "",
      onUpdate: changed,
    });
    editors.push(editor);
    const footer = createEditorFooter(editor, locale);
    document.body.append(footer);
    const help = footer.querySelector<HTMLButtonElement>(
      ".jwsoft-editor-help-button",
    )!;
    return { editor, footer, help, changed };
  }
  it.each(["minimal", "standard", "full"])(
    "shows one footer on %s and keeps it out of saved HTML",
    async (toolbar) => {
      document.body.innerHTML = '<div id="jwsoft-tiptap-content"></div>';
      await initEditorHandler(
        { params: { name: "content", content: "<p>글</p>", toolbar } },
        undefined,
      );
      expect(document.querySelectorAll(".jwsoft-editor-footer")).toHaveLength(
        1,
      );
      expect(
        document.querySelector(".jwsoft-editor-identity")?.textContent,
      ).toContain(`jw-editorv${manifest.version}`);
      expect(editorRegistry.get("jwsoft-tiptap-content", "ko")!.getHTML()).toBe(
        "<p>글</p>",
      );
    },
  );
  it("keeps help available in read-only mode", async () => {
    document.body.innerHTML = '<div id="jwsoft-tiptap-content"></div>';
    await initEditorHandler(
      { params: { name: "content", content: "<p>읽기</p>", readOnly: true } },
      undefined,
    );
    document
      .querySelector<HTMLButtonElement>(".jwsoft-editor-help-button")!
      .click();
    expect(document.querySelector("dialog[open]")).not.toBeNull();
    expect(document.querySelector('[contenteditable="true"]')).toBeNull();
  });
  it("opens a named modal, closes with Escape and restores focus without a document update", () => {
    const { footer, help, changed, editor } = setup();
    help.click();
    const dialog = footer.querySelector("dialog")!;
    expect(dialog.open).toBe(true);
    expect(dialog.querySelector("h2")?.textContent).toBe("jw-editor 도움말");
    expect(help.type).toBe("button");
    dialog.dispatchEvent(new Event("cancel", { cancelable: true }));
    expect(dialog.open).toBe(false);
    expect(document.activeElement).toBe(help);
    expect(changed).not.toHaveBeenCalled();
    expect(editor.getHTML()).toBe("<p>본문</p>");
  });
  it("shows current source as inert read-only text and copies only on request", async () => {
    const { footer, help, editor } = setup("en");
    const copy = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: copy },
    });
    help.click();
    editor.commands.setContent(
      "<p>새 본문 &lt;script&gt;alert(1)&lt;/script&gt;</p>",
    );
    const details = footer.querySelector("details")!;
    details.open = true;
    details.dispatchEvent(new Event("toggle"));
    const source = footer.querySelector("textarea")!;
    expect(source.readOnly).toBe(true);
    expect(source.value).toContain("새 본문 &lt;script&gt;");
    expect(footer.querySelector("script")).toBeNull();
    expect(copy).not.toHaveBeenCalled();
    footer
      .querySelector<HTMLButtonElement>(".jwsoft-editor-source-actions button")!
      .click();
    await Promise.resolve();
    expect(copy).toHaveBeenCalledWith(editor.getHTML());
    expect(footer.querySelector('[role="status"]')?.textContent).toBe(
      "Copied.",
    );
    editor.destroy();
    expect(footer.isConnected).toBe(false);
    expect(document.documentElement.style.overflow).not.toBe("hidden");
  });
  it("provides a keyboard copy fallback when clipboard access is denied", async () => {
    const { footer, help } = setup();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
    });
    help.click();
    footer.querySelector("details")!.open = true;
    footer
      .querySelector<HTMLButtonElement>(".jwsoft-editor-source-actions button")!
      .click();
    const source = footer.querySelector("textarea")!;
    await vi.waitFor(() => {
      expect(source.selectionEnd - source.selectionStart).toBe(
        source.value.length,
      );
    });
    expect(footer.querySelector('[role="status"]')?.textContent).toContain(
      "Ctrl/⌘ + C",
    );
  });
});
