import {
  enhanceContentMedia,
  startContentMediaObserver,
  stopContentMediaObserver,
} from "@/editor/mediaRenderer";

describe("content media renderer", () => {
  beforeEach(() => {
    document.body.replaceChildren();
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
    vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
  });
  afterEach(() => {
    stopContentMediaObserver();
    vi.restoreAllMocks();
  });

  it("enhances late G7 content and the same figure after a host rerender", async () => {
    startContentMediaObserver();
    document.body.innerHTML = '<div class="jwsoft-tiptap-content"></div>';
    await Promise.resolve();
    const container = document.querySelector(".jwsoft-tiptap-content")!;
    const source =
      '<a class="jw-media-source" href="/api/plugins/jwsoft-tiptap-editor/media/abcdef123456">actual-file.mp4</a>';
    container.innerHTML = `<figure class="jw-media jw-media-mp4">${source}</figure>`;
    await Promise.resolve();
    expect(container.querySelector("video")?.controls).toBe(true);
    expect(container.querySelector("video")?.getAttribute("aria-label")).toBe(
      "actual-file.mp4",
    );
    const figure = container.querySelector("figure")!;
    figure.innerHTML = source;
    await Promise.resolve();
    expect(figure.querySelectorAll("video")).toHaveLength(1);
    expect(enhanceContentMedia()).toBe(0);
  });

  it("keeps a safe original link and retry action after MP4 load failure", () => {
    document.body.innerHTML =
      '<div class="jwsoft-tiptap-content"><figure class="jw-media jw-media-mp4"><a class="jw-media-source" href="/api/plugins/jwsoft-tiptap-editor/media/abcdef123456">clip.mp4</a></figure></div>';
    enhanceContentMedia();
    document.querySelector("video")!.dispatchEvent(new Event("error"));
    expect(document.querySelector("[role=alert]")?.textContent).toContain(
      "불러오지 못했습니다",
    );
    expect(
      document
        .querySelector<HTMLAnchorElement>(".jw-media-original")
        ?.getAttribute("href"),
    ).toContain("abcdef123456");
    document.querySelector<HTMLButtonElement>("[role=alert] button")!.click();
    expect(document.querySelector("video")).not.toBeNull();
  });

  it("respects explicit click-to-load without enabling autoplay", () => {
    document.body.innerHTML = `<div class="jwsoft-tiptap-content"><figure class="jw-media jw-media-16x9 jw-media-youtube"><a class="jw-media-source" href="https://www.youtube.com/watch?v=dQw4w9WgXcQ">영상</a></figure></div>`;
    expect(enhanceContentMedia({ loadMode: "click" })).toBe(1);
    const button = document.querySelector<HTMLButtonElement>(".jw-media-load");
    expect(button?.textContent).toContain("YouTube");
    expect(document.querySelector("iframe")).toBeNull();
    button?.click();
    const iframe = document.querySelector<HTMLIFrameElement>("iframe");
    expect(iframe?.src).toContain("youtube-nocookie.com/embed/dQw4w9WgXcQ");
    expect(iframe?.src).toContain("autoplay=0");
  });

  it("displays external players immediately by default without autoplay", () => {
    document.body.innerHTML = `<div class="jwsoft-tiptap-content"><figure class="jw-media jw-media-youtube"><a class="jw-media-source" href="https://youtu.be/dQw4w9WgXcQ">영상</a></figure></div>`;
    expect(enhanceContentMedia()).toBe(1);
    expect(document.querySelector(".jw-media-load")).toBeNull();
    expect(document.querySelector("iframe")?.src).toContain("autoplay=0");
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

  it("uses decoded MP4 dimensions for a compact exact-ratio public player", () => {
    document.body.innerHTML = `<div class="jwsoft-tiptap-content"><figure class="jw-media jw-media-16x9 jw-media-mp4"><a class="jw-media-source" href="https://cdn.example.com/portrait.mp4">portrait.mp4</a></figure></div>`;
    enhanceContentMedia();
    const figure = document.querySelector<HTMLElement>("figure.jw-media")!;
    const video = figure.querySelector<HTMLVideoElement>("video")!;
    Object.defineProperties(video, {
      videoWidth: { configurable: true, value: 720 },
      videoHeight: { configurable: true, value: 1280 },
    });
    video.dispatchEvent(new Event("loadedmetadata"));
    expect(figure.classList.contains("jw-media-fit-portrait")).toBe(true);
    expect(figure.style.aspectRatio).toBe("720 / 1280");
  });

  it("does not enhance a mismatched provider URL", () => {
    document.body.innerHTML = `<div class="jwsoft-tiptap-content"><figure class="jw-media jw-media-youtube"><a class="jw-media-source" href="https://evil.example/video">영상</a></figure></div>`;
    expect(enhanceContentMedia()).toBe(0);
    expect(document.querySelector(".jw-media-source")).not.toBeNull();
  });

  it("reapplies loading and autoplay changes on the same figure", () => {
    document.body.innerHTML =
      '<div class="jwsoft-tiptap-content"><figure class="jw-media jw-media-youtube"><a class="jw-media-source" href="https://youtu.be/dQw4w9WgXcQ">video</a></figure></div>';
    enhanceContentMedia({ autoplay: true });
    expect(document.querySelector("iframe")?.src).toContain("autoplay=1");
    enhanceContentMedia({ loadMode: "click", autoplay: false });
    expect(document.querySelector("iframe")).toBeNull();
    document.querySelector<HTMLButtonElement>(".jw-media-load")!.click();
    expect(document.querySelector("iframe")?.src).toContain("autoplay=0");
    enhanceContentMedia({ loadMode: "immediate", autoplay: false });
    expect(document.querySelectorAll("iframe")).toHaveLength(1);
    expect(
      enhanceContentMedia({ loadMode: "immediate", autoplay: false }),
    ).toBe(0);
    stopContentMediaObserver();
    expect(document.querySelector("iframe")).toBeNull();
    expect(document.querySelector("a.jw-media-source")).not.toBeNull();
  });
});
