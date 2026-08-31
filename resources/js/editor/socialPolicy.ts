import { EDITOR_POLICY } from "@/generated/editorPolicy";
import { booleanParam } from "@/editor/content";
import {
  mediaPlaybackOptions,
  type ExternalMediaLoadMode,
} from "@/editor/mediaPlayer";

export type SocialProvider = "x" | "facebook";
export interface SocialEmbed {
  provider: SocialProvider;
  url: string;
  id: string;
}
export interface SocialOptions {
  x: boolean;
  facebook: boolean;
  loadMode: ExternalMediaLoadMode;
}

export function socialOptions(params: Record<string, unknown>): SocialOptions {
  const enabled =
    booleanParam(params.smartCards) && booleanParam(params.socialCards);
  return {
    x: enabled && booleanParam(params.xEmbed),
    facebook: enabled && booleanParam(params.facebookEmbed),
    loadMode:
      mediaPlaybackOptions(params.externalMediaLoadMode, false).loadMode ??
      "immediate",
  };
}

/** Only public post-shaped URLs; never accepts arbitrary HTML, SDK URLs or redirect wrappers. */
export function normalizeSocialUrl(value: unknown): SocialEmbed | null {
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
    if (url.protocol !== "https:") return null;
    const rawPath = value.match(/^https:\/\/[^/?#]+([^?#]*)/i)?.[1];
    if (authority.toLowerCase() !== url.hostname || rawPath !== url.pathname)
      return null;
    for (const provider of ["x", "facebook"] as const) {
      const policy = EDITOR_POLICY.externalEmbeds[provider];
      if (!(policy.hosts as readonly string[]).includes(url.hostname)) continue;
      const match = url.pathname.match(new RegExp(policy.pathPattern));
      if (!match) return null;
      return {
        provider,
        url: `https://${policy.canonicalHost}${provider === "facebook" ? `/${match[1]}/${match[2]}/${match[3]}` : url.pathname.replace(/\/$/, "")}`,
        id: provider === "x" ? match[1] : "",
      };
    }
  } catch {
    /* Invalid URL remains an ordinary link. */
  }
  return null;
}
