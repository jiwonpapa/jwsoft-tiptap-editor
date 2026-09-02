import type { G7CoreApi } from "@/g7/types";
import { analyzeLegacyHtml, sanitizeClientHtml } from "@/policy/runtimePolicy";
import { setEditorPolicyAcknowledgement } from "@/editor/stateSync";

export interface PolicyConsent {
  set: (locale: string, approved: boolean) => void;
}

const sessions = new WeakMap<
  G7CoreApi,
  Map<HTMLElement, Map<string, boolean>>
>();

/** Approval belongs to every field/locale in the current form, not the visible tab. */
export function createPolicyConsent(
  core: G7CoreApi | undefined,
  container: HTMLElement,
  content: Record<string, string>,
): PolicyConsent {
  const fields =
    (core && sessions.get(core)) ??
    new Map<HTMLElement, Map<string, boolean>>();
  for (const element of fields.keys()) {
    if (!element.isConnected) fields.delete(element);
  }
  const locales = new Map(
    Object.entries(content).map(([locale, value]) => [
      locale,
      !analyzeLegacyHtml(value, sanitizeClientHtml(value)).hasLoss,
    ]),
  );
  fields.set(container, locales);
  if (core) sessions.set(core, fields);
  return {
    set: (locale, approved) => {
      locales.set(locale, approved);
      for (const element of fields.keys()) {
        if (!element.isConnected) fields.delete(element);
      }
      setEditorPolicyAcknowledgement(
        core,
        [...fields.values()].every((values) =>
          [...values.values()].every(Boolean),
        ),
      );
    },
  };
}
