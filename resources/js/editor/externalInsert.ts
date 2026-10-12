import type { JSONContent } from "@tiptap/core";
import { normalizeMediaUrl, type MediaEmbedOptions } from "@/editor/mediaEmbed";
import { normalizeExternalInput } from "@/editor/socialInput";
import { fetchLinkPreview } from "@/editor/smartCard";

export interface ExternalInsertOptions {
  mediaEmbed: boolean;
  mediaOptions: MediaEmbedOptions;
}

/** Known players use the same allowlist as paste; only cards need metadata. */
export async function resolveExternalInsert(
  input: string,
  options: ExternalInsertOptions,
  locale: string,
  signal: AbortSignal,
  request: typeof fetch = fetch,
): Promise<JSONContent> {
  const url = normalizeExternalInput(input);
  const media =
    url && options.mediaEmbed
      ? normalizeMediaUrl(url, options.mediaOptions)
      : null;
  if (media) return { type: "mediaEmbed", attrs: media };
  return {
    type: "smartCard",
    attrs: await fetchLinkPreview(input, request, locale, signal),
  };
}
