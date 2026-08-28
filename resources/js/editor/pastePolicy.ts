import { analyzeLegacyHtml, sanitizeClientHtml } from "@/policy/runtimePolicy";

export interface SanitizedPaste {
  html: string;
  changed: boolean;
}

export function sanitizePastedHtml(html: string): SanitizedPaste {
  const sanitized = sanitizeClientHtml(html);
  return {
    html: sanitized,
    changed: analyzeLegacyHtml(html, sanitized).hasLoss,
  };
}
