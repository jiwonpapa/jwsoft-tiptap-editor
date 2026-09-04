import { booleanParam } from "@/editor/content";
import {
  mediaPlaybackOptions,
  type ExternalMediaLoadMode,
} from "@/editor/mediaPlayer";
import { EDITOR_POLICY } from "@/generated/editorPolicy";

export type SocialProvider = "x" | "facebook" | "instagram" | "tiktok";
export interface SocialEmbed {
  provider: SocialProvider;
  url: string;
  id: string;
}
export interface SocialOptions {
  x: boolean;
  facebook: boolean;
  instagram: boolean;
  tiktok: boolean;
  loadMode: ExternalMediaLoadMode;
}

function queryId(url: URL, name: string, pattern: string): string | null {
  const values = url.searchParams.getAll(name);
  return values.length === 1 &&
    values[0].match(new RegExp(pattern))?.[0] === values[0]
    ? values[0]
    : null;
}

function safeUrl(value: unknown): URL | null {
  if (
    typeof value !== "string" ||
    value.length > 2048 ||
    /[\s\\\x00-\x1f\x7f]/u.test(value)
  )
    return null;
  const authority = value.match(/^https:\/\/([^/?#]+)/i)?.[1];
  if (!authority || authority.includes(":") || authority.includes("@"))
    return null;
  try {
    const url = new URL(value);
    const rawPath = value.match(/^https:\/\/[^/?#]+([^?#]*)/i)?.[1];
    return url.protocol === "https:" &&
      authority.toLowerCase() === url.hostname &&
      rawPath === url.pathname
      ? url
      : null;
  } catch {
    return null;
  }
}

function facebookEmbed(url: URL): SocialEmbed | null {
  const policy = EDITOR_POLICY.externalEmbeds.facebook;
  if (!(policy.hosts as readonly string[]).includes(url.hostname)) return null;
  for (const format of [policy.photo, policy.permalink, policy.watch]) {
    if (!(format.paths as readonly string[]).includes(url.pathname)) continue;
    const id = queryId(url, format.idParameter, format.idPattern);
    if (!id) return null;
    let query = `${format.idParameter}=${id}`;
    if ("ownerParameter" in format) {
      const owner = queryId(url, format.ownerParameter, format.ownerPattern);
      if (!owner) return null;
      query += `&${format.ownerParameter}=${owner}`;
    }
    return {
      provider: "facebook",
      url: `https://${policy.canonicalHost}${format.canonicalPath}?${query}`,
      id: "",
    };
  }
  const reel = url.pathname.match(new RegExp(policy.reelPattern));
  if (reel)
    return {
      provider: "facebook",
      url: `https://${policy.canonicalHost}/reel/${reel[1]}`,
      id: "",
    };
  const match = url.pathname.match(new RegExp(policy.pathPattern));
  return match
    ? {
        provider: "facebook",
        url: `https://${policy.canonicalHost}/${match[1]}/${match[2]}/${match[3]}`,
        id: "",
      }
    : null;
}

function regularEmbed(url: URL): SocialEmbed | null {
  for (const provider of ["x", "instagram", "tiktok"] as const) {
    const policy = EDITOR_POLICY.externalEmbeds[provider];
    if (!(policy.hosts as readonly string[]).includes(url.hostname)) continue;
    const match = url.pathname.match(new RegExp(policy.pathPattern));
    if (!match) return null;
    if (provider === "x")
      return {
        provider,
        url: `https://${policy.canonicalHost}${url.pathname.replace(/\/$/, "")}`,
        id: match[1],
      };
    if (provider === "instagram")
      return {
        provider,
        url: `https://${policy.canonicalHost}/${match[1]}/${match[2]}/`,
        id: match[2],
      };
    return {
      provider,
      url: `https://${policy.canonicalHost}/@${match[1]}/video/${match[2]}`,
      id: match[2],
    };
  }
  return null;
}

export function socialOptions(params: Record<string, unknown>): SocialOptions {
  const enabled =
    booleanParam(params.smartCards) && booleanParam(params.socialCards);
  return {
    x: enabled && booleanParam(params.xEmbed),
    facebook: enabled && booleanParam(params.facebookEmbed),
    instagram: enabled && booleanParam(params.instagramEmbed),
    tiktok: enabled && booleanParam(params.tiktokEmbed),
    loadMode:
      mediaPlaybackOptions(params.externalMediaLoadMode, false).loadMode ??
      "immediate",
  };
}

/** Only public post-shaped URLs; never accepts arbitrary HTML, SDK URLs or redirect wrappers. */
export function normalizeSocialUrl(value: unknown): SocialEmbed | null {
  const url = safeUrl(value);
  if (!url) return null;
  return facebookEmbed(url) ?? regularEmbed(url);
}
