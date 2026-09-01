import { normalizeMediaUrl, type MediaProvider } from "@/editor/mediaEmbed";
import {
  applyIntrinsicMediaLayout,
  createMediaPlayer,
  resetIntrinsicMediaLayout,
  type MediaPlaybackOptions,
} from "@/editor/mediaPlayer";
export type { ExternalMediaLoadMode } from "@/editor/mediaPlayer";

const enhancedFigures = new WeakMap<
  HTMLElement,
  ReturnType<typeof createMediaPlayer>
>();

function providerFrom(figure: HTMLElement): MediaProvider | null {
  if (figure.classList.contains("jw-media-youtube")) return "youtube";
  if (figure.classList.contains("jw-media-vimeo")) return "vimeo";
  if (figure.classList.contains("jw-media-mp4")) return "mp4";
  return null;
}

export function enhanceContentMedia(
  options: MediaPlaybackOptions & { root?: ParentNode } = {},
): number {
  const root = options.root ?? document;
  let enhanced = 0;
  for (const figure of root.querySelectorAll<HTMLElement>(
    ".jwsoft-tiptap-content figure.jw-media",
  )) {
    if (figure.closest(".jwsoft-tiptap-editable")) continue;
    const previous = enhancedFigures.get(figure);
    if (previous?.dom.parentElement === figure) continue;
    previous?.destroy();
    const provider = providerFrom(figure);
    const source = figure.querySelector<HTMLAnchorElement>("a.jw-media-source");
    const media = source
      ? normalizeMediaUrl(source.getAttribute("href") ?? "")
      : null;
    if (!provider || !media || media.provider !== provider) continue;
    resetIntrinsicMediaLayout(figure);
    const player = createMediaPlayer(
      { ...media, title: source?.textContent?.trim() || media.title },
      options,
      (size) => applyIntrinsicMediaLayout(figure, size),
    );
    enhancedFigures.set(figure, player);
    figure.replaceChildren(player.dom);
    enhanced += 1;
  }
  return enhanced;
}

let contentObserver: MutationObserver | null = null;
let lifecycleInstalled = false;
let currentOptions: MediaPlaybackOptions = {};

/** G7 mounts the extension before asynchronous body data and may replace its HTML later. */
export function startContentMediaObserver(
  options: MediaPlaybackOptions = {},
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
