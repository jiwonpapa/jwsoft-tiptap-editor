import { enhanceContentMedia } from "@/editor/mediaRenderer";

describe("content media renderer", () => {
  beforeEach(() => document.body.replaceChildren());

  it("loads an allowlisted player only after a click by default", () => {
    document.body.innerHTML = `<div class="jwsoft-tiptap-content"><figure class="jw-media jw-media-16x9 jw-media-youtube"><a class="jw-media-source" href="https://www.youtube.com/watch?v=dQw4w9WgXcQ">영상</a></figure></div>`;
    expect(enhanceContentMedia()).toBe(1);
    const button = document.querySelector<HTMLButtonElement>(".jw-media-load");
    expect(button?.textContent).toContain("YouTube");
    expect(document.querySelector("iframe")).toBeNull();
    button?.click();
    const iframe = document.querySelector<HTMLIFrameElement>("iframe");
    expect(iframe?.src).toContain("youtube-nocookie.com/embed/dQw4w9WgXcQ");
    expect(iframe?.src).toContain("autoplay=0");
  });

  it("creates a muted responsive MP4 player in immediate autoplay mode", () => {
    document.body.innerHTML = `<div class="jwsoft-tiptap-content"><figure class="jw-media jw-media-16x9 jw-media-mp4"><a class="jw-media-source" href="https://cdn.example.com/video.mp4">영상</a></figure></div>`;
    expect(enhanceContentMedia({ loadMode: "immediate", autoplay: true })).toBe(
      1,
    );
    const video = document.querySelector<HTMLVideoElement>("video");
    expect(video?.controls).toBe(true);
    expect(video?.autoplay).toBe(true);
    expect(video?.muted).toBe(true);
    expect(video?.getAttribute("playsinline")).not.toBeNull();
  });

  it("does not enhance a mismatched provider URL", () => {
    document.body.innerHTML = `<div class="jwsoft-tiptap-content"><figure class="jw-media jw-media-youtube"><a class="jw-media-source" href="https://evil.example/video">영상</a></figure></div>`;
    expect(enhanceContentMedia()).toBe(0);
    expect(document.querySelector(".jw-media-source")).not.toBeNull();
  });
});
