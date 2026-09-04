import { createEditor } from "@/editor/createEditor";
import { insertAutomaticUrl } from "@/editor/automaticUrl";
import type { Editor } from "@tiptap/core";

const url = "https://x.com/jwsoft/status/123";
const youtube = "https://www.youtube.com/watch?v=WuWsLSR2ajA";
const preview = () =>
  new Response(
    JSON.stringify({
      success: true,
      data: {
        url,
        provider: "x",
        provider_label: "X",
        title: "Actual post",
        description: "Post content",
        image_url: null,
      },
    }),
    { headers: { "Content-Type": "application/json" } },
  );

describe("automatic URL conversion", () => {
  const editors: Editor[] = [];
  afterEach(() => {
    editors.forEach((editor) => editor.destroy());
    editors.length = 0;
    document.body.replaceChildren();
  });
  function setup(content = "<p></p>", enabled = true) {
    const mount = document.createElement("div");
    const status = document.createElement("div");
    document.body.append(mount, status);
    let finish!: (response: Response) => void;
    const request = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve;
        }),
    );
    const options = {
      media: enabled,
      cards: enabled,
      mediaOptions: { youtube: true, vimeo: true, mp4: true },
      status,
      locale: "ko",
      request,
    };
    const editor: Editor = createEditor({
      element: mount,
      content,
      placeholder: "",
      editable: true,
      onUpdate: vi.fn(),
      onPlainUrlPasted: (value, from, to) =>
        insertAutomaticUrl(editor, value, from, to, options),
    });
    editors.push(editor);
    return {
      editor,
      request,
      status,
      options,
      finish: (response: Response) => finish(response),
    };
  }
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

  it("converts a typed YouTube URL on Enter once and undo restores the URL", () => {
    const { editor } = setup(`<p>${youtube}</p>`);
    editor.commands.setTextSelection(youtube.length + 1);
    editor.view.dom.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
        cancelable: true,
      }),
    );
    expect(editor.getHTML()).toContain("jw-media-youtube");
    expect(
      editor.getJSON().content?.filter((node) => node.type === "mediaEmbed"),
    ).toHaveLength(1);
    editor.commands.undo();
    expect(editor.getHTML()).toContain(youtube.replace(/&/g, "&amp;"));
    expect(editor.getHTML()).not.toContain("jw-media-youtube");
  });

  it("converts an official YouTube iframe snippet without storing its HTML", () => {
    const { editor } = setup();
    const paste = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(paste, "clipboardData", {
      value: {
        files: [],
        getData: (type: string) =>
          type === "text/plain"
            ? '<iframe src="https://www.youtube-nocookie.com/embed/WuWsLSR2ajA"></iframe>'
            : "",
      },
    });
    editor.view.dom.dispatchEvent(paste);
    expect(paste.defaultPrevented).toBe(true);
    expect(editor.getHTML()).toContain("jw-media-youtube");
    expect(editor.getHTML()).not.toContain("iframe");
  });

  it.each([{ shiftKey: true }, { isComposing: true }])(
    "does not intercept modified or composing Enter %o",
    (extra) => {
      const { editor, request } = setup(`<p>${url}</p>`);
      editor.commands.setTextSelection(url.length + 1);
      editor.view.dom.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true, ...extra }),
      );
      expect(request).not.toHaveBeenCalled();
    },
  );

  it("respects both disabled flags", () => {
    const { editor, options, request } = setup("<p></p>", false);
    expect(insertAutomaticUrl(editor, youtube, 1, undefined, options)).toBe(
      false,
    );
    expect(insertAutomaticUrl(editor, url, 1, undefined, options)).toBe(false);
    expect(request).not.toHaveBeenCalled();
  });

  it("keeps the source visible while fetching and maps later replacement past preceding edits", async () => {
    const { editor, options, finish } = setup();
    insertAutomaticUrl(editor, url, 1, undefined, options);
    expect(editor.getHTML()).toContain(url);
    editor.commands.insertContentAt(0, {
      type: "paragraph",
      content: [{ type: "text", text: "앞 문단" }],
    });
    editor.commands.insertContentAt(
      editor.state.doc.content.size - 1,
      "뒷 문단",
    );
    finish(preview());
    await settle();
    expect(editor.getHTML()).toMatch(/^<p>앞 문단<\/p><figure/);
    expect(editor.getHTML()).toContain("Actual post");
    expect(editor.getHTML()).toContain("<p>뒷 문단</p>");
    editor.commands.undo();
    expect(editor.getHTML()).toContain(url);
    expect(editor.getHTML()).not.toContain("jw-card");
    expect(editor.getHTML()).toContain("뒷 문단");
  });

  it("does not insert a late preview after the URL is edited or removed", async () => {
    const { editor, options, finish, status } = setup();
    insertAutomaticUrl(editor, url, 1, undefined, options);
    editor.commands.insertContentAt(
      { from: 1, to: url.length + 1 },
      "다른 내용",
    );
    finish(preview());
    await settle();
    expect(editor.getHTML()).not.toContain("jw-card");
    expect(editor.getHTML()).toContain("다른 내용");
    expect(status.textContent).toContain("취소");
  });

  it("does not insert a late preview into a destroyed editor", async () => {
    const { editor, options, finish } = setup();
    insertAutomaticUrl(editor, url, 1, undefined, options);
    editor.destroy();
    finish(preview());
    await settle();
    expect(editor.isDestroyed).toBe(true);
    expect(document.querySelector(".jw-card")).toBeNull();
  });

  it("keeps exactly one original URL and reports a rejected preview", async () => {
    const { editor, options, finish, status } = setup();
    insertAutomaticUrl(editor, url, 1, undefined, options);
    finish(new Response(JSON.stringify({ success: false }), { status: 422 }));
    await settle();
    expect(editor.getJSON().content?.[0].content).toHaveLength(1);
    expect(editor.getText().trim()).toBe(url);
    expect(editor.getHTML()).not.toContain("jw-card");
    expect(status.textContent).toContain("원래 URL을 유지");
  });
});
