import { editorContainerId } from "@/editor/content";
import { editorRegistry } from "@/editor/editorRegistry";
import {
  startEditorLifecycleCleanup,
  stopEditorLifecycleCleanup,
} from "@/editor/editorLifecycle";
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
    stopEditorLifecycleCleanup();
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

  it("destroys detached route editors without leaking instances", async () => {
    startEditorLifecycleCleanup();

    for (let route = 0; route < 100; route += 1) {
      const container = addContainer();
      await initEditorHandler(
        {
          params: {
            name: "content",
            content: `<p>화면 ${route + 1}</p>`,
          },
        },
        undefined,
      );
      expect(editorRegistry.size).toBe(1);

      container.remove();
      await Promise.resolve();
      expect(editorRegistry.size).toBe(0);
    }
  }, 10_000);

  it("keeps an editor that is synchronously reparented", async () => {
    startEditorLifecycleCleanup();
    const firstParent = document.createElement("section");
    const secondParent = document.createElement("section");
    document.body.append(firstParent, secondParent);
    const container = document.createElement("div");
    container.id = editorContainerId("content");
    firstParent.appendChild(container);

    await initEditorHandler(
      { params: { name: "content", content: "<p>이동</p>" } },
      undefined,
    );
    secondParent.appendChild(container);
    await Promise.resolve();

    expect(editorRegistry.size).toBe(1);
    expect(container.querySelector(".tiptap")?.textContent).toBe("이동");
  });

  it("destroys all editors on non-persisted pagehide only", async () => {
    startEditorLifecycleCleanup();
    addContainer();
    await initEditorHandler(
      { params: { name: "content", content: "<p>본문</p>" } },
      undefined,
    );

    window.dispatchEvent(
      new PageTransitionEvent("pagehide", { persisted: true }),
    );
    expect(editorRegistry.size).toBe(1);

    window.dispatchEvent(
      new PageTransitionEvent("pagehide", { persisted: false }),
    );
    expect(editorRegistry.size).toBe(0);
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
    expect(
      container.querySelector(".jwsoft-tiptap-legacy-warning")?.textContent,
    ).toContain("저장이 차단");
    expect(
      container.querySelector(".jwsoft-tiptap-legacy-warning")?.textContent,
    ).toContain("자동 변환되지 않습니다");
    expect(
      container.querySelector(".jwsoft-tiptap-legacy-warning")?.textContent,
    ).toContain("CKEditor를 다시 활성화");
    expect(
      container.querySelector(".jwsoft-tiptap-legacy-warning")?.textContent,
    ).toContain("설치·활성화·조회만으로 저장된 원문은 바뀌지 않습니다");
    expect(
      container.querySelector(".jwsoft-tiptap-legacy-warning")?.textContent,
    ).toContain("수정 후 저장할 때");
    expect(window.G7Core?.state?.setLocal).not.toHaveBeenCalledWith(
      expect.objectContaining({ "form.content": expect.anything() }),
      expect.anything(),
    );
    expect(
      container.querySelector<HTMLButtonElement>("[data-primary='true']")
        ?.textContent,
    ).toBe("위험 확인 후 편집 계속");

    container
      .querySelector<HTMLButtonElement>("[data-primary='true']")
      ?.click();
    expect(editable?.getAttribute("contenteditable")).toBe("true");
    expect(container.querySelector(".jwsoft-tiptap-legacy-warning")).toBeNull();
    expect(window.G7Core?.state?.setLocal).toHaveBeenCalledWith(
      expect.objectContaining({
        "form.jwsoft_editor_policy_ack": expect.any(String),
      }),
      { render: false, selfManaged: true },
    );
  });

  it.each(["", "<p>안전한 기존 본문</p>"])(
    "does not show a legacy warning for blank or compatible content: %s",
    async (content) => {
      const container = addContainer();
      await initEditorHandler(
        { params: { name: "content", content } },
        undefined,
      );
      expect(
        container.querySelector(".jwsoft-tiptap-legacy-warning"),
      ).toBeNull();
      expect(
        container.querySelector(".tiptap")?.getAttribute("contenteditable"),
      ).toBe("true");
    },
  );

  it("does not ask for transition acknowledgement when only viewing legacy content", async () => {
    const container = addContainer();
    await initEditorHandler(
      {
        params: {
          name: "content",
          content: '<p style="color:red">조회</p>',
          readOnly: true,
        },
      },
      undefined,
    );
    expect(container.querySelector(".jwsoft-tiptap-legacy-warning")).toBeNull();
    expect(
      container.querySelector(".tiptap")?.getAttribute("contenteditable"),
    ).toBe("false");
    expect(window.G7Core?.state?.setLocal).not.toHaveBeenCalled();
  });

  it("keeps one multilingual editor instance while switching locales", async () => {
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
    const tabs = container.querySelectorAll<HTMLButtonElement>(
      ".jwsoft-tiptap-locale-tab",
    );
    expect(tabs).toHaveLength(2);
    editorRegistry
      .get(editorContainerId("content"), "ko")
      ?.commands.setContent("<p>수정한 한국어</p>");
    tabs[1].click();
    expect(editorRegistry.size).toBe(1);
    expect(
      editorRegistry.get(editorContainerId("content"), "ko"),
    ).toBeUndefined();
    expect(container.textContent).toContain("English");
    tabs[0].click();
    expect(editorRegistry.size).toBe(1);
    expect(container.textContent).toContain("수정한 한국어");
  });

  it("localizes editor status, toolbar, and dialogs in English", async () => {
    window.G7Core = {
      ...window.G7Core,
      locale: { current: () => "en", supported: () => ["en", "ko"] },
    };
    const container = addContainer();
    await initEditorHandler(
      { params: { name: "content", content: "<p>English content</p>" } },
      undefined,
    );

    expect(container.querySelector("[role='status']")?.textContent).toBe("");
    expect(
      container.querySelector("[role='toolbar']")?.getAttribute("aria-label"),
    ).toBe("standard editor tools");
    expect(
      [...container.querySelectorAll<HTMLButtonElement>("button")].some(
        (button) => button.textContent === "Bold",
      ),
    ).toBe(true);
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

  it("runs selected-range and class-token commands from the standard toolbar", async () => {
    const container = addContainer();
    await initEditorHandler(
      { params: { name: "content", content: "<p>가나다</p>" } },
      undefined,
    );
    const editor = editorRegistry.get(editorContainerId("content"), "ko");
    expect(editor).toBeDefined();
    editor?.commands.setTextSelection({ from: 2, to: 3 });

    const bold = [
      ...container.querySelectorAll<HTMLButtonElement>("button"),
    ].find((button) => button.textContent === "굵게");
    expect(bold?.disabled).toBe(false);
    bold?.click();

    const alignment = container.querySelector<HTMLSelectElement>(
      "select[aria-label='정렬']",
    );
    expect(alignment).not.toBeNull();
    if (alignment) {
      alignment.value = "jw-align-center";
      alignment.dispatchEvent(new Event("change"));
    }
    expect(editor?.getHTML()).toBe(
      '<p class="jw-align-center">가<strong>나</strong>다</p>',
    );
  });

  it("indents policy blocks and nests list items from toolbar controls", async () => {
    const container = addContainer();
    await initEditorHandler(
      {
        params: {
          name: "content",
          content: "<p>첫째</p><p>둘째</p>",
        },
      },
      undefined,
    );
    const editor = editorRegistry.get(editorContainerId("content"), "ko");
    const button = (label: string) =>
      [...container.querySelectorAll<HTMLButtonElement>("button")].find(
        (candidate) => candidate.textContent === label,
      );

    editor?.commands.setTextSelection(2);
    expect(button("내어쓰기")?.disabled).toBe(true);
    button("들여쓰기")?.click();
    expect(editor?.getHTML()).toBe(
      '<p class="jw-indent-1">첫째</p><p>둘째</p>',
    );
    button("들여쓰기")?.click();
    button("들여쓰기")?.click();
    button("들여쓰기")?.click();
    expect(editor?.getHTML()).toContain('class="jw-indent-4"');
    expect(button("들여쓰기")?.disabled).toBe(true);
    button("내어쓰기")?.click();
    expect(editor?.getHTML()).toContain('class="jw-indent-3"');

    editor?.commands.setContent(
      "<ul><li><p>첫째</p></li><li><p>둘째</p></li></ul>",
    );
    let secondItemPosition = 0;
    editor?.state.doc.descendants((node, position) => {
      if (node.isText && node.text === "둘째") secondItemPosition = position;
    });
    editor?.commands.setTextSelection(secondItemPosition + 1);
    button("들여쓰기")?.click();
    expect(editor?.getHTML()).toBe(
      "<ul><li><p>첫째</p><ul><li><p>둘째</p></li></ul></li></ul><p></p>",
    );
    button("내어쓰기")?.click();
    expect(editor?.getHTML()).toBe(
      "<ul><li><p>첫째</p></li><li><p>둘째</p></li></ul><p></p>",
    );
  });

  it("supports minimal/full profiles and omits editing controls in read-only mode", async () => {
    const minimal = addContainer("summary");
    await initEditorHandler(
      {
        params: {
          name: "summary",
          content: "<p>요약</p>",
          toolbar: "minimal",
        },
      },
      undefined,
    );
    expect(minimal.querySelector("[role='toolbar']")?.textContent).toContain(
      "링크",
    );
    expect(minimal.querySelector("[role='toolbar']")?.textContent).toContain(
      "이미지",
    );

    const full = addContainer("description");
    await initEditorHandler(
      {
        params: {
          name: "description",
          content: "<p>설명</p>",
          toolbar: "full",
        },
      },
      undefined,
    );
    const panels = [...full.querySelectorAll(".jwsoft-tiptap-popover")];
    expect(
      panels.find((panel) => panel.getAttribute("aria-label") === "도구 더보기")
        ?.textContent,
    ).toBe("도구 더보기찾기 / 바꾸기전체화면");
    expect(
      panels.find((panel) => panel.getAttribute("aria-label") === "목록")
        ?.textContent,
    ).toBe("목록글머리 목록번호 목록체크리스트");
    expect(panels.some((panel) => panel.textContent?.includes("표 삭제"))).toBe(
      false,
    );
    expect(
      full.querySelector('.jwsoft-tiptap-toolbar [aria-label^="실행취소"]'),
    ).not.toBeNull();

    const readOnly = addContainer("notice");
    await initEditorHandler(
      {
        params: {
          name: "notice",
          content: "<p>공지</p>",
          readOnly: true,
        },
      },
      undefined,
    );
    expect(readOnly.querySelector("[role='toolbar']")).toBeNull();
  });

  it("opens the link dialog and creates a hardened blank-target link", async () => {
    const container = addContainer();
    await initEditorHandler(
      { params: { name: "content", content: "<p>링크</p>" } },
      undefined,
    );
    const editor = editorRegistry.get(editorContainerId("content"), "ko");
    editor?.commands.setTextSelection({ from: 1, to: 3 });
    const trigger = [
      ...container.querySelectorAll<HTMLButtonElement>("button"),
    ].find((button) => button.textContent === "링크");
    trigger?.click();
    const dialog = container.querySelector<HTMLElement>(
      ".jwsoft-tiptap-dialog[open]",
    );
    expect(dialog).not.toBeNull();
    const inputs = dialog?.querySelectorAll<HTMLInputElement>("input");
    if (inputs) {
      inputs[0].value = "https://example.com";
      inputs[1].value = "예시";
      inputs[2].checked = true;
    }
    dialog
      ?.querySelector("form")
      ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    expect(editor?.getHTML()).toBe(
      '<p><a target="_blank" rel="noopener noreferrer" href="https://example.com" title="예시">링크</a></p>',
    );
  });

  it("inserts policy-tokenized tables and URL images from dialogs", async () => {
    const tableContainer = addContainer("table_content");
    await initEditorHandler(
      {
        params: { name: "table_content", content: "<p>표 앞</p>" },
      },
      undefined,
    );
    const tableTrigger = [
      ...tableContainer.querySelectorAll<HTMLButtonElement>("button"),
    ].find((button) => button.textContent === "표");
    tableTrigger?.click();
    const tableDialog = tableContainer.querySelector<HTMLElement>(
      ".jwsoft-tiptap-dialog[open]",
    );
    const tableInputs = tableDialog?.querySelectorAll<HTMLInputElement>(
      "input[type='number']",
    );
    if (tableInputs) {
      tableInputs[0].value = "2";
      tableInputs[1].value = "2";
    }
    tableDialog
      ?.querySelector("form")
      ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    const tableHtml = editorRegistry
      .get(editorContainerId("table_content"), "ko")
      ?.getHTML();
    expect(tableHtml).toContain('<table class="jw-table">');
    expect(tableHtml).toContain("<th");
    expect(tableHtml).not.toContain("style=");

    const imageContainer = addContainer("image_content");
    await initEditorHandler(
      {
        params: { name: "image_content", content: "<p></p>" },
      },
      undefined,
    );
    const imageTrigger = [
      ...imageContainer.querySelectorAll<HTMLButtonElement>("button"),
    ].find((button) => button.textContent === "이미지");
    imageTrigger?.click();
    const imageDialog = imageContainer.querySelector<HTMLElement>(
      ".jwsoft-tiptap-dialog[open]",
    );
    const imageInputs =
      imageDialog?.querySelectorAll<HTMLInputElement>("input");
    if (imageInputs) {
      imageInputs[0].value = "/assets/example.webp";
      imageInputs[1].value = "예시 이미지";
      imageInputs[2].value = "이미지 캡션";
      imageInputs[3].value = "이미지 제목";
    }
    const alignment = imageDialog?.querySelector<HTMLSelectElement>(
      "select[aria-label='이미지 정렬']",
    );
    const size = imageDialog?.querySelector<HTMLSelectElement>(
      "select[aria-label='이미지 크기']",
    );
    if (alignment) alignment.value = "right";
    if (size) size.value = "50";
    imageDialog
      ?.querySelector("form")
      ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    const imageHtml = editorRegistry
      .get(editorContainerId("image_content"), "ko")
      ?.getHTML();
    const wrapper = document.createElement("div");
    wrapper.innerHTML = imageHtml ?? "";
    const figure = wrapper.querySelector("figure");
    const image = wrapper.querySelector("img");
    expect(figure?.className).toBe(
      "jw-image jw-image-align-right jw-image-size-50",
    );
    expect(image?.getAttribute("src")).toBe("/assets/example.webp");
    expect(image?.getAttribute("alt")).toBe("예시 이미지");
    expect(wrapper.querySelector("figcaption")?.textContent).toBe(
      "이미지 캡션",
    );
    expect(imageHtml).not.toContain("style=");

    const imageEditor = editorRegistry.get(
      editorContainerId("image_content"),
      "ko",
    );
    let imagePosition = -1;
    imageEditor?.state.doc.descendants((node, position) => {
      if (node.type.name === "image") imagePosition = position;
    });
    imageEditor?.commands.setNodeSelection(imagePosition);
    imageTrigger?.click();
    expect(
      imageDialog?.querySelector<HTMLButtonElement>("button[type='submit']")
        ?.textContent,
    ).toBe("이미지 적용");
    const editInputs = imageDialog?.querySelectorAll<HTMLInputElement>("input");
    if (editInputs) editInputs[2].value = "수정 캡션";
    if (alignment) alignment.value = "left";
    if (size) size.value = "25";
    imageDialog
      ?.querySelector("form")
      ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    const updatedHtml = imageEditor?.getHTML() ?? "";
    expect(updatedHtml).toContain(
      '<figure class="jw-image jw-image-align-left jw-image-size-25">',
    );
    expect(updatedHtml).toContain("<figcaption>수정 캡션</figcaption>");
    expect(updatedHtml).not.toContain("style=");
  });

  it("moves toolbar focus with arrow keys and closes dialogs with Escape", async () => {
    const container = addContainer();
    await initEditorHandler(
      { params: { name: "content", content: "<p>본문</p>" } },
      undefined,
    );
    const buttons = [
      ...container.querySelectorAll<HTMLButtonElement>("button"),
    ];
    const bold = buttons.find((button) => button.textContent === "굵게");
    const italic = buttons.find((button) => button.textContent === "기울임");
    bold?.focus();
    bold?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
    );
    expect(document.activeElement).toBe(italic);

    const link = buttons.find((button) => button.textContent === "링크");
    link?.click();
    const dialog = container.querySelector<HTMLElement>(
      ".jwsoft-tiptap-dialog[open]",
    );
    dialog?.dispatchEvent(new Event("cancel", { cancelable: true }));
    expect((dialog as HTMLDialogElement)?.open).toBe(false);
    expect(document.activeElement).toBe(link);
  });

  it("shows a reversible warning when clipboard HTML loses unsupported formatting", async () => {
    const container = addContainer();
    await initEditorHandler(
      { params: { name: "content", content: "<p></p>" } },
      undefined,
    );
    const event = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "clipboardData", {
      value: {
        getData: (type: string) =>
          type === "text/html"
            ? '<p style="color:red" onclick="alert(1)">붙여넣기</p>'
            : "",
      },
    });
    container.querySelector(".tiptap")?.dispatchEvent(event);

    expect(container.querySelector("[role='status']")?.textContent).toContain(
      "실행취소",
    );
    expect(
      editorRegistry.get(editorContainerId("content"), "ko")?.getHTML(),
    ).toBe("<p>붙여넣기</p>");
  });
});
