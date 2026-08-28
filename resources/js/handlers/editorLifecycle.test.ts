import { editorContainerId } from "@/editor/content";
import { editorRegistry } from "@/editor/editorRegistry";
import { destroyEditorHandler } from "@/handlers/destroyEditor";
import { initEditorHandler } from "@/handlers/initEditor";

describe("G7 editor lifecycle", () => {
  beforeEach(() => {
    editorRegistry.destroyAll();
    document.body.replaceChildren();
    document.head
      .querySelectorAll("[id^='jwsoft-tiptap-']")
      .forEach((node) => node.remove());
    window.__SirsoftCkeditor5 = undefined;
    window.CKEDITOR = undefined;
    window.G7Core = {
      locale: { current: () => "ko", supported: () => ["ko", "en"] },
      state: {
        getLocal: () => ({ form: { content_mode: "html" } }),
        setLocal: vi.fn(),
      },
    };
  });

  afterEach(() => {
    editorRegistry.destroyAll();
  });

  function addContainer(name = "content"): HTMLElement {
    const container = document.createElement("div");
    container.id = editorContainerId(name);
    document.body.appendChild(container);
    return container;
  }

  it("mounts one server-policy-backed Tiptap instance and destroys it on unmount", async () => {
    const container = addContainer();
    await initEditorHandler(
      {
        params: {
          name: "content",
          content: "<p>초기 본문</p>",
          placeholder: "내용",
          height: 320,
        },
      },
      undefined,
    );

    expect(editorRegistry.size).toBe(1);
    expect(container.querySelector(".tiptap")?.textContent).toBe("초기 본문");
    expect(
      container.querySelector(".tiptap")?.getAttribute("contenteditable"),
    ).toBe("true");
    expect(container.getAttribute("aria-readonly")).toBe("false");
    expect(container.style.getPropertyValue("--jwsoft-tiptap-height")).toBe(
      "320px",
    );

    await destroyEditorHandler({ params: { name: "content" } }, undefined);
    expect(editorRegistry.size).toBe(0);
    expect(container.childElementCount).toBe(0);
  });

  it("keeps lossy legacy HTML read-only until the user acknowledges it", async () => {
    const container = addContainer();
    await initEditorHandler(
      {
        params: {
          name: "content",
          content: '<p style="text-align:center">기존 본문</p>',
        },
      },
      undefined,
    );

    const editable = container.querySelector(".tiptap");
    expect(editable?.getAttribute("contenteditable")).toBe("false");
    expect(container.querySelector("[role='alert']")?.textContent).toContain(
      "저장이 차단",
    );

    container
      .querySelector<HTMLButtonElement>("[data-primary='true']")
      ?.click();
    expect(editable?.getAttribute("contenteditable")).toBe("true");
    expect(container.querySelector("[role='alert']")).toBeNull();
    expect(window.G7Core?.state?.setLocal).toHaveBeenCalledWith(
      expect.objectContaining({
        "form.jwsoft_editor_policy_ack": expect.any(String),
      }),
      { render: false, selfManaged: true },
    );
  });

  it("mounts multilingual content lazily by locale", async () => {
    const container = addContainer();
    await initEditorHandler(
      {
        params: {
          name: "content",
          multilingual: true,
          content: { ko: "<p>한국어</p>", en: "<p>English</p>" },
        },
      },
      undefined,
    );

    expect(editorRegistry.size).toBe(1);
    const tabs = container.querySelectorAll<HTMLButtonElement>("[role='tab']");
    expect(tabs).toHaveLength(2);
    tabs[1].click();
    expect(editorRegistry.size).toBe(2);
    expect(container.textContent).toContain("English");
  });

  it("blocks initialization when CKEditor is loaded", async () => {
    const container = addContainer();
    window.__SirsoftCkeditor5 = {};
    await initEditorHandler({ params: { name: "content" } }, undefined);
    expect(editorRegistry.size).toBe(0);
    expect(container.querySelector("[role='alert']")?.textContent).toContain(
      "sirsoft-ckeditor5",
    );
  });
});
