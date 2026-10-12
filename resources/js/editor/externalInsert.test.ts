import { describe, expect, it, vi } from "vitest";
import { createEditor } from "@/editor/createEditor";
import { resolveExternalInsert } from "@/editor/externalInsert";

const options = {
  mediaEmbed: true,
  mediaOptions: { youtube: true, vimeo: true, mp4: true },
};
const signal = () => new AbortController().signal;

describe("manual external insertion", () => {
  it.each([
    ["https://youtu.be/dQw4w9WgXcQ", "youtube"],
    [
      '<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ" allowfullscreen></iframe>',
      "youtube",
    ],
    [
      '<iframe src="https://player.vimeo.com/video/76979871"></iframe>',
      "vimeo",
    ],
    ["https://example.com/video.mp4", "mp4"],
  ])(
    "inserts %s without depending on preview requests",
    async (input, provider) => {
      const request = vi.fn(async () => {
        throw new Error("preview unavailable");
      });
      const content = await resolveExternalInsert(
        input,
        options,
        "ko",
        signal(),
        request,
      );
      expect(content).toMatchObject({
        type: "mediaEmbed",
        attrs: { provider },
      });
      expect(request).not.toHaveBeenCalled();
      const editor = createEditor({
        element: document.createElement("div"),
        content: "",
        placeholder: "",
        editable: true,
        onUpdate: () => undefined,
      });
      try {
        expect(editor.commands.insertContent(content)).toBe(true);
        expect(editor.getHTML()).toContain(`jw-media-${provider}`);
        expect(editor.getHTML()).not.toMatch(/<iframe|<script|style=|onload=/i);
      } finally {
        editor.destroy();
      }
    },
  );

  it.each([
    { ...options, mediaEmbed: false },
    { ...options, mediaOptions: { ...options.mediaOptions, youtube: false } },
  ])("does not bypass a disabled media setting", async (disabled) => {
    const request = vi.fn(async () => {
      throw new Error("preview unavailable");
    });
    await expect(
      resolveExternalInsert(
        "https://youtu.be/dQw4w9WgXcQ",
        disabled,
        "ko",
        signal(),
        request,
      ),
    ).rejects.toThrow("preview unavailable");
    expect(request).toHaveBeenCalledOnce();
  });

  it("rejects an unapproved iframe before making a request", async () => {
    const request = vi.fn(async () => new Response());
    await expect(
      resolveExternalInsert(
        '<iframe src="https://example.com/embed"></iframe>',
        options,
        "ko",
        signal(),
        request,
      ),
    ).rejects.toThrow("지원하는 주소");
    expect(request).not.toHaveBeenCalled();
  });

  it("keeps server validation and cancellation for ordinary card metadata", async () => {
    const abort = signal();
    const request = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            success: true,
            data: {
              url: "https://example.com/post",
              provider: "generic",
              provider_label: "example.com",
              title: "Article",
              description: "",
              image_url: null,
            },
          }),
          { status: 200 },
        ),
    );
    const content = await resolveExternalInsert(
      "https://example.com/post",
      options,
      "ko",
      abort,
      request,
    );
    expect(content).toMatchObject({
      type: "smartCard",
      attrs: { title: "Article" },
    });
    expect(request).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ signal: abort }),
    );
  });
});
