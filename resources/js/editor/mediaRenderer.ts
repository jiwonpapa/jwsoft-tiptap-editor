import { normalizeMediaUrl, type MediaProvider } from "@/editor/mediaEmbed";

export type ExternalMediaLoadMode = "click" | "immediate";

const enhancedFigures = new WeakSet<HTMLElement>();

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
    if (autoplay) {
      video.autoplay = true;
      video.muted = true;
    }
    return video;
  }

  const iframe = document.createElement("iframe");
  const url = new URL(playerUrl);
  url.searchParams.set("autoplay", autoplay ? "1" : "0");
  if (autoplay) url.searchParams.set("muted", "1");
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
    if (enhancedFigures.has(figure)) continue;
    const provider = providerFrom(figure);
    const source = figure.querySelector<HTMLAnchorElement>("a.jw-media-source");
    const media = source
      ? normalizeMediaUrl(source.getAttribute("href") ?? "")
      : null;
    if (!provider || !media || media.provider !== provider) continue;
    enhancedFigures.add(figure);
    enhanced += 1;

    const mountPlayer = (): void => {
      figure.replaceChildren(
        playerFor(
          provider,
          media.playerUrl,
          source?.textContent?.trim() || media.title,
          Boolean(options.autoplay),
        ),
      );
    };
    if (loadMode === "immediate") {
      mountPlayer();
      continue;
    }

    const button = document.createElement("button");
    button.type = "button";
    button.className = "jw-media-load";
    button.textContent = `${provider === "mp4" ? "MP4" : provider === "youtube" ? "YouTube" : "Vimeo"} 플레이어 불러오기`;
    button.addEventListener("click", mountPlayer, { once: true });
    figure.replaceChildren(button);
  }

  return enhanced;
}
