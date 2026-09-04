import {
  facebook,
  instagram,
  parse,
  tiktok,
  twitter,
  vimeo,
  youtube,
  type SocialLinkParsedLink,
} from "social-media-parser";

const MAX_URL_LENGTH = 2048;
const MAX_EMBED_SOURCE_LENGTH = 100_000;
const REPRESENTATIVE_PARSERS = [
  youtube,
  vimeo,
  twitter,
  facebook,
  instagram,
  tiktok,
];

function safeHttpsUrl(value: string): string | null {
  if (!value || value.length > MAX_URL_LENGTH) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port)
      return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function representativeUrl(
  value: string,
  parsed: SocialLinkParsedLink,
): string {
  if (parsed.platform === "twitter") {
    const postId = parsed.entities.post_id;
    const username = parsed.entities.username;
    if (!postId) return parsed.url;
    return username
      ? `https://x.com/${username}/status/${postId}`
      : `https://x.com/i/web/status/${postId}`;
  }
  if (parsed.platform !== "instagram") return parsed.url;
  const postId = parsed.entities.post_id;
  const pathType = new URL(value).pathname.match(/^\/(p|reel|tv)\//)?.[1];
  return postId && pathType
    ? `https://www.instagram.com/${pathType}/${postId}/`
    : parsed.url;
}

function normalizeRepresentativeUrl(value: string): string | null {
  const safe = safeHttpsUrl(value);
  if (!safe) return null;
  const parsed = parse(safe, { parsers: REPRESENTATIVE_PARSERS });
  return parsed ? representativeUrl(safe, parsed) : null;
}

function facebookPluginTarget(value: string): string | null {
  const safe = safeHttpsUrl(value);
  if (!safe) return null;
  const url = new URL(safe);
  if (
    !["facebook.com", "www.facebook.com"].includes(url.hostname) ||
    !["/plugins/post.php", "/plugins/video.php"].includes(url.pathname)
  )
    return null;
  return url.searchParams.get("href");
}

function sourceCandidates(source: string): string[] {
  const document = new DOMParser().parseFromString(source, "text/html");
  const candidates: string[] = [];
  for (const [selector, attribute] of [
    [".instagram-media", "data-instgrm-permalink"],
    [".tiktok-embed", "cite"],
    [".fb-post, .fb-video", "data-href"],
  ]) {
    for (const element of document.querySelectorAll(selector)) {
      candidates.push(element.getAttribute(attribute) ?? "");
    }
  }
  for (const element of document.querySelectorAll("iframe[src]")) {
    const sourceUrl = element.getAttribute("src") ?? "";
    candidates.push(facebookPluginTarget(sourceUrl) ?? sourceUrl);
  }
  for (const element of document.querySelectorAll("blockquote a[href]")) {
    candidates.push(element.getAttribute("href") ?? "");
  }
  return candidates;
}

/** Accept a plain HTTPS URL or extract one from an official provider embed snippet. */
export function normalizeExternalInput(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_EMBED_SOURCE_LENGTH) return null;
  if (!trimmed.includes("<")) {
    const safe = safeHttpsUrl(trimmed);
    return safe ? (normalizeRepresentativeUrl(safe) ?? safe) : null;
  }
  for (const candidate of sourceCandidates(trimmed)) {
    const normalized = normalizeRepresentativeUrl(candidate);
    if (normalized) return normalized;
  }
  return null;
}
