import { createEditor } from "@/editor/createEditor";
import { insertMediaEmbed, normalizeMediaUrl } from "@/editor/mediaEmbed";

describe("safe media embeds", () => {
  it.each([
    ["https://youtu.be/dQw4w9WgXcQ", "youtube", "16x9"],
    ["https://www.youtube.com/shorts/dQw4w9WgXcQ", "youtube", "9x16"],
    ["https://vimeo.com/76979871", "vimeo", "16x9"],
    ["https://cdn.example.com/movie.mp4", "mp4", "16x9"],
    ["/api/plugins/jwsoft-tiptap-editor/media/abcdef123456", "mp4", "16x9"],
  ])("normalizes %s", (url, provider, ratio) => {
    expect(normalizeMediaUrl(url)).toMatchObject({ provider, ratio });
  });

  it("rejects arbitrary hosts, credentials, schemes, and disabled providers", () => {
    expect(normalizeMediaUrl("javascript:alert(1)")).toBeNull();
    expect(
      normalizeMediaUrl("https://youtube.example/embed/dQw4w9WgXcQ"),
    ).toBeNull();
    expect(
      normalizeMediaUrl("https://user:pass@vimeo.com/76979871"),
    ).toBeNull();
    expect(
      normalizeMediaUrl("https://youtu.be/dQw4w9WgXcQ", {
        youtube: false,
        vimeo: true,
        mp4: true,
      }),
    ).toBeNull();
  });

  it("serializes a media node as a canonical link, never an iframe or video", () => {
    const mount = document.createElement("div");
    document.body.appendChild(mount);
    const editor = createEditor({
      element: mount,
      content: "<p></p>",
      placeholder: "",
      editable: true,
      onUpdate: vi.fn(),
    });
    const media = normalizeMediaUrl("https://youtu.be/dQw4w9WgXcQ");
    expect(media).not.toBeNull();
    expect(insertMediaEmbed(editor, media!)).toBe(true);
    expect(editor.getHTML()).toContain("jw-media-youtube");
    expect(editor.getHTML()).toContain(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    );
    expect(editor.getHTML()).not.toMatch(/<iframe|<video/u);
    editor.destroy();
    mount.remove();
  });

  it("converts a supported URL pasted into an empty paragraph", () => {
    const mount = document.createElement("div");
    document.body.appendChild(mount);
    let editor: ReturnType<typeof createEditor>;
    editor = createEditor({
      element: mount,
      content: "<p></p>",
      placeholder: "",
      editable: true,
      onUpdate: vi.fn(),
      onMediaUrlPasted: (url) => {
        const media = normalizeMediaUrl(url);
        return media ? insertMediaEmbed(editor, media) : false;
      },
    });
    const paste = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(paste, "clipboardData", {
      value: {
        files: [],
        getData: (type: string) =>
          type === "text/plain" ? "https://vimeo.com/76979871" : "",
      },
    });
    editor.view.dom.dispatchEvent(paste);

    expect(paste.defaultPrevented).toBe(true);
    expect(editor.getHTML()).toContain("jw-media-vimeo");
    editor.destroy();
    mount.remove();
  });
});
