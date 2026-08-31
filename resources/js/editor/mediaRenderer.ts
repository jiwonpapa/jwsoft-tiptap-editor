import { normalizeMediaUrl, type MediaProvider } from "@/editor/mediaEmbed";

export type ExternalMediaLoadMode = "click" | "immediate";

const enhancedFigures = new WeakMap<HTMLElement, HTMLElement>();

function providerFrom(figure: HTMLElement): MediaProvider | null {
  if (figure.classList.contains("jw-media-youtube")) return "youtube";
  if (figure.classList.contains("jw-media-vimeo")) return "vimeo";
  if (figure.classList.contains("jw-media-mp4")) return "mp4";
  return null;
}

function playerFor(
  provider: MediaProvider,
  playerUrl: string,
  title: string,
  autoplay: boolean,
): HTMLElement {
  if (provider === "mp4") {
    const video = document.createElement("video");
    video.className = "jw-media-player";
    video.src = playerUrl;
    video.controls = true;
    video.playsInline = true;
    video.preload = "metadata";
    video.setAttribute("aria-label", title);
    if (autoplay) {
      video.autoplay = true;
      video.muted = true;
    }
    return video;
  }

  const iframe = document.createElement("iframe");
  const url = new URL(playerUrl);
  url.searchParams.set("autoplay", autoplay ? "1" : "0");
  if (autoplay)
    url.searchParams.set(provider === "youtube" ? "mute" : "muted", "1");
  if (provider === "youtube") url.searchParams.set("playsinline", "1");
  iframe.className = "jw-media-player";
  iframe.src = url.toString();
  iframe.title = title;
  iframe.loading = "lazy";
  iframe.referrerPolicy = "strict-origin-when-cross-origin";
  iframe.allow =
    "accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen";
  iframe.allowFullscreen = true;
  return iframe;
}

export function enhanceContentMedia(
  options: {
    root?: ParentNode;
    loadMode?: ExternalMediaLoadMode;
    autoplay?: boolean;
  } = {},
): number {
  const root = options.root ?? document;
  const loadMode = options.loadMode === "immediate" ? "immediate" : "click";
  let enhanced = 0;

  for (const figure of root.querySelectorAll<HTMLElement>(
    ".jwsoft-tiptap-content figure.jw-media",
  )) {
    if (figure.closest(".jwsoft-tiptap-editable")) continue;
    if (enhancedFigures.get(figure)?.parentElement === figure) continue;
    const provider = providerFrom(figure);
    const source = figure.querySelector<HTMLAnchorElement>("a.jw-media-source");
    const media = source
      ? normalizeMediaUrl(source.getAttribute("href") ?? "")
      : null;
    if (!provider || !media || media.provider !== provider) continue;
    enhanced += 1;

    const title = source?.textContent?.trim() || media.title;
    const fallback = document.createElement("a");
    fallback.className = "jw-media-original";
    fallback.href = media.sourceUrl;
    fallback.target = "_blank";
    fallback.rel = "noopener noreferrer";
    fallback.textContent = `${title} · 원본 열기`;

    const mountPlayer = (): void => {
      const player = playerFor(
        provider,
        media.playerUrl,
        title,
        Boolean(options.autoplay),
      );
      enhancedFigures.set(figure, player);
      player.addEventListener(
        "error",
        () => {
          const message = document.createElement("p");
          message.className = "jw-media-error";
          message.setAttribute("role", "alert");
          message.textContent =
            "영상을 불러오지 못했습니다. 원본 링크를 확인하거나 다시 시도하십시오.";
          const retry = document.createElement("button");
          retry.type = "button";
          retry.textContent = "다시 시도";
          retry.addEventListener("click", mountPlayer, { once: true });
          message.append(retry);
          enhancedFigures.set(figure, message);
          figure.replaceChildren(message, fallback);
        },
        { once: true },
      );
      figure.replaceChildren(player, fallback);
    };
    const localUpload =
      provider === "mp4" &&
      new URL(media.sourceUrl, window.location.origin).origin ===
        window.location.origin;
    if (loadMode === "immediate" || localUpload) {
      mountPlayer();
      continue;
    }

    const button = document.createElement("button");
    button.type = "button";
    button.className = "jw-media-load";
    button.textContent = `${provider === "mp4" ? "MP4" : provider === "youtube" ? "YouTube" : "Vimeo"} 플레이어 불러오기`;
    button.addEventListener("click", mountPlayer, { once: true });
    enhancedFigures.set(figure, button);
    figure.replaceChildren(button, fallback);
  }

  return enhanced;
}

let contentObserver: MutationObserver | null = null;
let lifecycleInstalled = false;
let currentOptions: { loadMode?: ExternalMediaLoadMode; autoplay?: boolean } =
  {};

/** G7 mounts the extension before asynchronous body data and may replace its HTML later. */
export function startContentMediaObserver(
  options: typeof currentOptions = {},
): void {
  currentOptions = options;
  if (!lifecycleInstalled) {
    lifecycleInstalled = true;
    window.addEventListener("pagehide", stopContentMediaObserver);
    window.addEventListener("pageshow", (event) => {
      if (event.persisted) startContentMediaObserver(currentOptions);
    });
  }
  if (!contentObserver) {
    contentObserver = new MutationObserver((records) => {
      const relevant = records.some((record) => {
        const target =
          record.target instanceof Element
            ? record.target
            : record.target.parentElement;
        return (
          target?.closest(".jwsoft-tiptap-content") ||
          [...record.addedNodes].some(
            (node) =>
              node instanceof Element &&
              (node.matches(".jwsoft-tiptap-content") ||
                node.querySelector(".jwsoft-tiptap-content")),
          )
        );
      });
      if (relevant) enhanceContentMedia(currentOptions);
    });
    contentObserver.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "href"],
    });
  }
  enhanceContentMedia(currentOptions);
}

export function stopContentMediaObserver(): void {
  contentObserver?.disconnect();
  contentObserver = null;
}
