import type { G7CoreApi } from "@/g7/types";
import { EDITOR_POLICY_HASH } from "@/generated/editorPolicy";

export const EDITOR_POLICY_ACK_FIELD = "jwsoft_editor_policy_ack";

interface SyncEditorValueOptions {
  core: G7CoreApi | undefined;
  name: string;
  locale: string;
  value: string;
  multilingual: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function ensureHtmlMode(
  core: G7CoreApi | undefined,
  name: string,
): void {
  const state = core?.state;
  const local = state?.getLocal?.();
  const form = isRecord(local?.form) ? local.form : {};
  if (form[`${name}_mode`] !== "html") {
    state?.setLocal?.({ [`form.${name}_mode`]: "html" });
  }
}

export function setEditorPolicyAcknowledgement(
  core: G7CoreApi | undefined,
  acknowledged: boolean,
): void {
  core?.state?.setLocal?.(
    {
      [`form.${EDITOR_POLICY_ACK_FIELD}`]: acknowledged
        ? EDITOR_POLICY_HASH
        : null,
    },
    {
      render: false,
      selfManaged: true,
    },
  );
}

export function syncEditorValue({
  core,
  name,
  locale,
  value,
  multilingual,
}: SyncEditorValueOptions): boolean {
  const state = core?.state;
  if (!state?.setLocal) return false;

  const latest = state.getLocal?.();
  const form = isRecord(latest?.form) ? latest.form : {};
  const current = multilingual
    ? isRecord(form[name])
      ? form[name][locale]
      : undefined
    : form[name];
  if (current === value) return false;

  const updates: Record<string, unknown> = {
    [`form.${name}_mode`]: "html",
    hasChanges: true,
  };
  updates[multilingual ? `form.${name}.${locale}` : `form.${name}`] = value;

  state.setLocal(updates, {
    debounce: 300,
    debounceKey: `jwsoft-tiptap-sync-${name}`,
    // Refresh G7's submission snapshot when the debounce settles. Updating only
    // global state lets a later responsive render submit an older form value.
    render: true,
    selfManaged: true,
  });
  return true;
}
