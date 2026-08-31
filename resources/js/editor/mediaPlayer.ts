import type { NormalizedMedia } from "@/editor/mediaEmbed";

export type ExternalMediaLoadMode = "click" | "immediate";
export interface MediaPlaybackOptions {
  loadMode?: ExternalMediaLoadMode;
  autoplay?: boolean;
}

export function mediaPlaybackOptions(
  loadMode: unknown,
  autoplay: unknown,
): MediaPlaybackOptions {
  return {
    loadMode: loadMode === "click" ? "click" : "immediate",
    autoplay: autoplay === true || autoplay === "true",
  };
}

/** Display-only DOM shared by the editor NodeView and the public renderer. */
export function createMediaPlayer(
  media: NormalizedMedia,
  options: MediaPlaybackOptions = {},
): { dom: HTMLElement; destroy: () => void } {
  const dom = document.createElement("div");
  dom.className = "jw-media-surface";
  const english = window.G7Core?.locale?.current?.() === "en";
  const original = document.createElement("a");
  original.className = "jw-media-original";
  original.href = media.sourceUrl;
  original.target = "_blank";
  original.rel = "noopener noreferrer";
  original.textContent = `${media.title} · ${english ? "Open original" : "원본 열기"}`;
  let disposed = false;
  let video: HTMLVideoElement | null = null;
  const clear = () => {
    if (video) {
      video.pause();
      video.removeAttribute("src");
      video.load();
      video = null;
    }
    dom.replaceChildren();
  };
  const mount = () => {
    if (disposed) return;
    clear();
    let player: HTMLVideoElement | HTMLIFrameElement;
    if (media.provider === "mp4") {
      video = document.createElement("video");
      video.src = media.playerUrl;
      video.controls = true;
      video.playsInline = true;
      video.preload = "metadata";
      video.setAttribute("aria-label", media.title);
      video.autoplay = Boolean(options.autoplay);
      video.muted = Boolean(options.autoplay);
      player = video;
    } else {
      const iframe = document.createElement("iframe");
      const url = new URL(media.playerUrl);
      url.searchParams.set("autoplay", options.autoplay ? "1" : "0");
      if (options.autoplay)
        url.searchParams.set(
          media.provider === "youtube" ? "mute" : "muted",
          "1",
        );
      if (media.provider === "youtube")
        url.searchParams.set("playsinline", "1");
      iframe.src = url.toString();
      iframe.title = media.title;
      iframe.loading = "lazy";
      iframe.referrerPolicy = "strict-origin-when-cross-origin";
      iframe.allow =
        "accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen";
      iframe.allowFullscreen = true;
      player = iframe;
    }
    player.className = "jw-media-player";
    player.addEventListener(
      "error",
      () => {
        if (disposed || player.parentElement !== dom) return;
        clear();
        const error = document.createElement("p");
        error.className = "jw-media-error";
        error.setAttribute("role", "alert");
        error.textContent = english
          ? "Unable to load the video. Open the original link or try again."
          : "영상을 불러오지 못했습니다. 원본 링크를 확인하거나 다시 시도하십시오.";
        const retry = document.createElement("button");
        retry.type = "button";
        retry.textContent = english ? "Try again" : "다시 시도";
        retry.addEventListener("click", mount, { once: true });
        error.append(retry);
        dom.append(error, original);
      },
      { once: true },
    );
    dom.append(player, original);
  };
  const localUpload =
    media.provider === "mp4" &&
    new URL(media.sourceUrl, window.location.origin).origin ===
      window.location.origin;
  if (options.loadMode !== "click" || localUpload) mount();
  else {
    const load = document.createElement("button");
    load.type = "button";
    load.className = "jw-media-load";
    const provider =
      media.provider === "youtube"
        ? "YouTube"
        : media.provider === "vimeo"
          ? "Vimeo"
          : "MP4";
    load.textContent = english
      ? `Load ${provider} player`
      : `${provider} 플레이어 불러오기`;
    load.addEventListener("click", mount, { once: true });
    dom.append(load, original);
  }
  return {
    dom,
    destroy: () => {
      disposed = true;
      clear();
    },
  };
}
