import type { G7CoreApi } from "@/g7/types";
import { EDITOR_POLICY_HASH } from "@/generated/editorPolicy";
import { normalizeEmptyEditorHtml } from "@/editor/meaningfulContent";

export const EDITOR_POLICY_ACK_FIELD = "jwsoft_editor_policy_ack";

// G7 getLocal() can still hold the pre-debounce value. A rapid revert must
// replace the pending write even when it equals that older snapshot.
const requestedValues = new WeakMap<G7CoreApi, Map<string, string>>();

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
  value = normalizeEmptyEditorHtml(value);

  const latest = state.getLocal?.();
  const form = isRecord(latest?.form) ? latest.form : {};
  const current = multilingual
    ? isRecord(form[name])
      ? form[name][locale]
      : undefined
    : form[name];
  const key = multilingual ? `${name}.${locale}` : name;
  let requested = core ? requestedValues.get(core) : undefined;
  if (
    current === value &&
    (!requested?.has(key) || requested.get(key) === value)
  )
    return false;
  if (core) {
    if (!requested) {
      requested = new Map();
      requestedValues.set(core, requested);
    }
    requested.set(key, value);
  }

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
