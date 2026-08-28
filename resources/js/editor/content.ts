import type { G7CoreApi, InitEditorParams } from "@/g7/types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringMap(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}

function localFormValue(core: G7CoreApi | undefined, name: string): unknown {
  const local = core?.state?.getLocal?.();
  return isRecord(local?.form) ? local.form[name] : undefined;
}

function selectedItemValue(core: G7CoreApi | undefined, name: string): unknown {
  const global = core?.state?.get?.();
  const wrapped = isRecord(global?._global) ? global._global : global;
  return isRecord(wrapped?.selectedItem)
    ? wrapped.selectedItem[name]
    : undefined;
}

export function booleanParam(value: unknown): boolean {
  return value === true || value === "true";
}

export function editorContainerId(name: string): string {
  return `jwsoft-tiptap-${name || "content"}`;
}

export function supportedLocales(core: G7CoreApi | undefined): string[] {
  const current = currentLocale(core);
  const configured = core?.locale?.supported?.() ?? [];
  return [...new Set([current, ...configured.filter(Boolean)])];
}

export function currentLocale(core: G7CoreApi | undefined): string {
  return core?.locale?.current?.() ?? localStorage.getItem("g7_locale") ?? "ko";
}

export function resolveSingleContent(
  params: InitEditorParams,
  core: G7CoreApi | undefined,
): string {
  const explicit = typeof params.content === "string" ? params.content : "";
  const unresolved = explicit.startsWith("{{") && explicit.endsWith("}}");
  if (explicit && !unresolved) return explicit;

  const name = params.name ?? "content";
  const local = localFormValue(core, name);
  if (typeof local === "string") return local;
  const selected = selectedItemValue(core, name);
  return typeof selected === "string" ? selected : "";
}

export function resolveMultilingualContent(
  params: InitEditorParams,
  core: G7CoreApi | undefined,
): Record<string, string> {
  let explicit: Record<string, string> = {};
  if (typeof params.content === "string") {
    const candidate = params.content.trim();
    if (candidate.startsWith("{") && !candidate.startsWith("{{")) {
      try {
        explicit = stringMap(JSON.parse(candidate));
      } catch {
        explicit = {};
      }
    }
  } else {
    explicit = stringMap(params.content);
  }
  if (Object.keys(explicit).length > 0) return explicit;

  const name = params.name ?? "content";
  const local = localFormValue(core, name);
  const localMap = stringMap(local);
  if (Object.keys(localMap).length > 0) return localMap;
  if (typeof local === "string" && local) {
    return { [currentLocale(core)]: local };
  }

  return stringMap(selectedItemValue(core, name));
}
