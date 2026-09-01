import { createEditor } from "@/editor/createEditor";
import { insertMediaEmbed, normalizeMediaUrl } from "@/editor/mediaEmbed";
import { enhanceContentMedia } from "@/editor/mediaRenderer";
import {
  mediaPlaybackOptions,
  type MediaPlaybackOptions,
} from "@/editor/mediaPlayer";

const editors: ReturnType<typeof createEditor>[] = [];
const mount = (
  mediaPlayback?: MediaPlaybackOptions,
  editable = true,
  content = "<p></p>",
) => {
  const element = document.createElement("div");
  document.body.append(element);
  const editor = createEditor({
    element,
    content,
    editable,
    placeholder: "",
    onUpdate: vi.fn(),
    mediaPlayback,
  });
  editors.push(editor);
  return editor;
};

describe("editor and read-view media parity", () => {
  beforeEach(() => {
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
    vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
  });
  afterEach(() => {
    for (const editor of editors.splice(0)) editor.destroy();
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it.each([
    ["https://youtu.be/dQw4w9WgXcQ", "iframe"],
    ["https://vimeo.com/76979871", "iframe"],
    ["/api/plugins/jwsoft-tiptap-editor/media/abcdef123456", "video"],
  ])(
    "uses identical real player markup before and after saving %s",
    (url, tag) => {
      const editor = mount();
      insertMediaEmbed(editor, {
        ...normalizeMediaUrl(url)!,
        title: "original-file.mp4",
      });
      const player = editor.view.dom.querySelector(tag)!;
      expect(player).not.toBeNull();
      const html = editor.getHTML();
      expect(html).not.toMatch(
        /<iframe|<video|<button|<svg|jwsoft-media|jw-media-surface/u,
      );
      expect(html).toContain('class="jw-media-source"');
      const output = document.createElement("div");
      output.className = "jwsoft-tiptap-content";
      output.innerHTML = html;
      document.body.append(output);
      enhanceContentMedia();
      expect(output.querySelector(tag)?.outerHTML).toBe(player.outerHTML);
      const reopened = mount(undefined, true, html);
      expect(reopened.view.dom.querySelector(tag)?.outerHTML).toBe(
        player.outerHTML,
      );
    },
  );

  it("preserves MP4 DOM across unrelated edits and pauses it on deletion", () => {
    const editor = mount();
    insertMediaEmbed(
      editor,
      normalizeMediaUrl(
        "/api/plugins/jwsoft-tiptap-editor/media/abcdef123456",
      )!,
    );
    const video = editor.view.dom.querySelector("video")!;
    expect(video.controls).toBe(true);
    expect(video.autoplay).toBe(false);
    editor.commands.insertContentAt(
      editor.state.doc.content.size,
      "<p>after media</p>",
    );
    expect(editor.view.dom.querySelector("video")).toBe(video);
    editor.view.dom
      .querySelector<HTMLButtonElement>('[aria-label="동영상 삭제"]')!
      .click();
    expect(editor.getHTML()).not.toContain("jw-media");
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();
    editor.commands.undo();
    expect(editor.view.dom.querySelector("video")).not.toBeNull();
    expect(editor.getHTML()).not.toContain("<video");
  });

  it("fits uploaded MP4 to its intrinsic portrait ratio without saving runtime styles", () => {
    const editor = mount();
    insertMediaEmbed(editor, {
      ...normalizeMediaUrl(
        "/api/plugins/jwsoft-tiptap-editor/media/abcdef123456",
      )!,
      title: "portrait.mp4",
    });
    const node =
      editor.view.dom.querySelector<HTMLElement>(".jwsoft-media-node")!;
    const figure = node.querySelector<HTMLElement>("figure.jw-media")!;
    const video = figure.querySelector<HTMLVideoElement>("video")!;
    Object.defineProperties(video, {
      videoWidth: { configurable: true, value: 1080 },
      videoHeight: { configurable: true, value: 1920 },
    });
    video.dispatchEvent(new Event("loadedmetadata"));

    expect(node.classList.contains("jw-media-fit-portrait")).toBe(true);
    expect(figure.style.aspectRatio).toBe("1080 / 1920");
    const html = editor.getHTML();
    expect(html).toContain("portrait.mp4");
    expect(html).not.toMatch(/jw-media-(?:intrinsic|fit-)|style=/u);

    const output = document.createElement("div");
    output.className = "jwsoft-tiptap-content";
    output.innerHTML = html;
    document.body.append(output);
    enhanceContentMedia();
    const outputVideo = output.querySelector<HTMLVideoElement>("video")!;
    Object.defineProperties(outputVideo, {
      videoWidth: { configurable: true, value: 1080 },
      videoHeight: { configurable: true, value: 1920 },
    });
    outputVideo.dispatchEvent(new Event("loadedmetadata"));
    const outputFigure = output.querySelector<HTMLElement>("figure.jw-media")!;
    expect(outputFigure.classList.contains("jw-media-fit-portrait")).toBe(true);
    expect(outputFigure.style.aspectRatio).toBe(figure.style.aspectRatio);
  });

  it("respects click mode for external providers but immediately shows local MP4", () => {
    const editor = mount({ loadMode: "click" });
    insertMediaEmbed(
      editor,
      normalizeMediaUrl("https://youtu.be/dQw4w9WgXcQ")!,
    );
    expect(editor.view.dom.querySelector("iframe")).toBeNull();
    editor.view.dom.querySelector<HTMLButtonElement>(".jw-media-load")!.click();
    expect(editor.view.dom.querySelector("iframe")?.src).toContain(
      "autoplay=0",
    );
    editor.commands.insertContentAt(editor.state.doc.content.size, {
      type: "mediaEmbed",
      attrs: {
        provider: "mp4",
        sourceUrl: "/api/plugins/jwsoft-tiptap-editor/media/abcdef123456",
      },
    });
    expect(editor.view.dom.querySelector("video")?.controls).toBe(true);
  });

  it("shares explicit autoplay settings and retains read-only playback without edit controls", () => {
    const writable = mount();
    insertMediaEmbed(
      writable,
      normalizeMediaUrl("https://youtu.be/dQw4w9WgXcQ")!,
    );
    const editor = mount({ autoplay: true }, false, writable.getHTML());
    expect(editor.view.dom.querySelector("iframe")?.src).toContain(
      "autoplay=1&mute=1",
    );
    expect(
      editor.view.dom.querySelector<HTMLElement>(".jwsoft-media-actions")
        ?.hidden,
    ).toBe(true);
    editor.setEditable(true);
    expect(
      editor.view.dom.querySelector<HTMLElement>(".jwsoft-media-actions")
        ?.hidden,
    ).toBe(false);
    editor.view.dom
      .querySelector<HTMLButtonElement>('[aria-label="동영상 선택·이동"]')!
      .click();
    expect(
      editor.view.dom.querySelector(".ProseMirror-selectednode"),
    ).not.toBeNull();
    const frame = editor.view.dom.querySelector("iframe")!;
    editor.destroy();
    expect(frame.isConnected).toBe(false);
  });

  it("normalizes shared G7 flags with immediate display and autoplay off by default", () => {
    expect(mediaPlaybackOptions(undefined, undefined)).toEqual({
      loadMode: "immediate",
      autoplay: false,
    });
    expect(mediaPlaybackOptions("click", "false")).toEqual({
      loadMode: "click",
      autoplay: false,
    });
    expect(mediaPlaybackOptions("immediate", "true")).toEqual({
      loadMode: "immediate",
      autoplay: true,
    });
  });
});
