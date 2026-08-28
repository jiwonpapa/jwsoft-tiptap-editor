import { Node, type Editor } from "@tiptap/core";

export type MediaProvider = "youtube" | "vimeo" | "mp4";
export type MediaRatio = "16x9" | "9x16";

export interface MediaEmbedOptions {
  youtube: boolean;
  vimeo: boolean;
  mp4: boolean;
}

export interface NormalizedMedia {
  provider: MediaProvider;
  sourceUrl: string;
  playerUrl: string;
  ratio: MediaRatio;
  title: string;
}

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/u;
const VIMEO_ID = /^[0-9]{5,12}$/u;

function normalizedUrl(value: string): URL | null {
  const candidate = value.trim();
  if (!candidate || candidate.startsWith("//")) return null;
  try {
    const parsed = new URL(candidate, window.location.origin);
    if (parsed.username || parsed.password) return null;
    if (
      parsed.origin !== window.location.origin &&
      parsed.protocol !== "https:"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function youtubeMedia(parsed: URL): NormalizedMedia | null {
  const host = parsed.hostname.toLowerCase().replace(/^www\./u, "");
  let id = "";
  let ratio: MediaRatio = "16x9";
  if (host === "youtu.be") {
    id = parsed.pathname.split("/").filter(Boolean)[0] ?? "";
  } else if (
    ["youtube.com", "m.youtube.com", "music.youtube.com"].includes(host)
  ) {
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts[0] === "watch") id = parsed.searchParams.get("v") ?? "";
    if (["embed", "shorts", "live"].includes(parts[0] ?? "")) {
      id = parts[1] ?? "";
      if (parts[0] === "shorts") ratio = "9x16";
    }
  } else if (host === "youtube-nocookie.com") {
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts[0] === "embed") id = parts[1] ?? "";
  }
  if (!YOUTUBE_ID.test(id)) return null;

  return {
    provider: "youtube",
    sourceUrl: `https://www.youtube.com/watch?v=${id}`,
    playerUrl: `https://www.youtube-nocookie.com/embed/${id}`,
    ratio,
    title: "YouTube video",
  };
}

function vimeoMedia(parsed: URL): NormalizedMedia | null {
  const host = parsed.hostname.toLowerCase().replace(/^www\./u, "");
  if (host !== "vimeo.com" && host !== "player.vimeo.com") return null;
  const parts = parsed.pathname.split("/").filter(Boolean);
  const id =
    host === "player.vimeo.com" && parts[0] === "video" ? parts[1] : parts[0];
  if (!id || !VIMEO_ID.test(id)) return null;
  return {
    provider: "vimeo",
    sourceUrl: `https://vimeo.com/${id}`,
    playerUrl: `https://player.vimeo.com/video/${id}`,
    ratio: "16x9",
    title: "Vimeo video",
  };
}

function mp4Media(value: string, parsed: URL): NormalizedMedia | null {
  const pluginMedia =
    /^\/api\/plugins\/jwsoft-tiptap-editor\/media\/[a-f0-9]{12}$/u;
  const relative =
    value.trim().startsWith("/") && !value.trim().startsWith("//");
  if (
    !parsed.pathname.toLowerCase().endsWith(".mp4") &&
    !pluginMedia.test(parsed.pathname)
  ) {
    return null;
  }
  const sourceUrl = relative
    ? `${parsed.pathname}${parsed.search}`
    : parsed.toString();
  return {
    provider: "mp4",
    sourceUrl,
    playerUrl: sourceUrl,
    ratio: "16x9",
    title: "MP4 video",
  };
}

export function normalizeMediaUrl(
  value: string,
  allowed: MediaEmbedOptions = { youtube: true, vimeo: true, mp4: true },
): NormalizedMedia | null {
  const parsed = normalizedUrl(value);
  if (!parsed) return null;
  const youtube = allowed.youtube ? youtubeMedia(parsed) : null;
  if (youtube) return youtube;
  const vimeo = allowed.vimeo ? vimeoMedia(parsed) : null;
  if (vimeo) return vimeo;
  return allowed.mp4 ? mp4Media(value, parsed) : null;
}

export function insertMediaEmbed(
  editor: Editor,
  media: NormalizedMedia,
): boolean {
  return editor
    .chain()
    .focus()
    .insertContent({
      type: "mediaEmbed",
      attrs: {
        provider: media.provider,
        sourceUrl: media.sourceUrl,
        ratio: media.ratio,
        title: media.title,
      },
    })
    .run();
}

export const MediaEmbedExtension = Node.create({
  name: "mediaEmbed",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      provider: { default: "mp4", rendered: false },
      sourceUrl: { default: "", rendered: false },
      ratio: { default: "16x9", rendered: false },
      title: { default: "Media", rendered: false },
    };
  },

  parseHTML() {
    return [
      {
        tag: "figure.jw-media",
        getAttrs: (node) => {
          if (!(node instanceof HTMLElement)) return false;
          const provider = (["youtube", "vimeo", "mp4"] as const).find(
            (value) => node.classList.contains(`jw-media-${value}`),
          );
          const source =
            node.querySelector<HTMLAnchorElement>("a.jw-media-source");
          if (!provider || !source) return false;
          const media = normalizeMediaUrl(source.getAttribute("href") ?? "");
          if (!media || media.provider !== provider) return false;
          return {
            provider,
            sourceUrl: media.sourceUrl,
            ratio: node.classList.contains("jw-media-9x16") ? "9x16" : "16x9",
            title: source.textContent?.trim() || media.title,
          };
        },
      },
    ];
  },

  renderHTML({ node }) {
    const media = normalizeMediaUrl(String(node.attrs.sourceUrl));
    if (!media) return ["p", {}, "Unsupported media URL"];
    const ratio = node.attrs.ratio === "9x16" ? "9x16" : "16x9";
    return [
      "figure",
      {
        class: `jw-media jw-media-${ratio} jw-media-${media.provider}`,
      },
      [
        "a",
        {
          class: "jw-media-source",
          href: media.sourceUrl,
          rel: "noopener noreferrer",
          target: "_blank",
        },
        String(node.attrs.title || media.title),
      ],
    ];
  },
});
