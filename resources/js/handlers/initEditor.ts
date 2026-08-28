import { hasConflictingEditorRuntime } from "@/editor/conflict";
import {
  booleanParam,
  currentLocale,
  editorContainerId,
  resolveMultilingualContent,
  resolveSingleContent,
  supportedLocales,
} from "@/editor/content";
import { createEditor } from "@/editor/createEditor";
import { editorRegistry } from "@/editor/editorRegistry";
import { injectEditorStyles } from "@/editor/editorStyles";
import { isEditorWriteEnabled } from "@/editor/runtimeGate";
import { ensureHtmlMode, syncEditorValue } from "@/editor/stateSync";
import type { G7Action, InitEditorParams } from "@/g7/types";

const LOCALE_LABELS: Record<string, string> = {
  ko: "한국어",
  en: "English",
  ja: "日本語",
  zh: "中文",
};

function paramsFrom(action: G7Action): InitEditorParams {
  return (action.params ?? {}) as InitEditorParams;
}

function safeHeight(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 400;
  return Math.min(1200, Math.max(160, Math.round(parsed)));
}

function renderFailure(container: HTMLElement, message: string): void {
  container.replaceChildren();
  const alert = document.createElement("div");
  alert.className = "jwsoft-tiptap-stage-notice";
  alert.setAttribute("role", "alert");
  alert.textContent = message;
  container.appendChild(alert);
}

function createShell(container: HTMLElement, height: number): HTMLElement {
  container.replaceChildren();
  container.style.setProperty("--jwsoft-tiptap-height", `${height}px`);
  const shell = document.createElement("div");
  shell.className = "jwsoft-tiptap-shell";
  const notice = document.createElement("div");
  notice.className = "jwsoft-tiptap-stage-notice";
  notice.setAttribute("role", "status");
  notice.textContent =
    "서버 저장 정책 연결 전 검증 단계입니다. 이 편집기는 현재 읽기 전용입니다.";
  shell.appendChild(notice);
  container.appendChild(shell);
  return shell;
}

function mountLocaleEditor(options: {
  containerId: string;
  mount: HTMLElement;
  name: string;
  locale: string;
  content: string;
  placeholder: string;
  editable: boolean;
  multilingual: boolean;
}): void {
  if (editorRegistry.has(options.containerId, options.locale)) return;
  const core = window.G7Core;
  const editor = createEditor({
    element: options.mount,
    content: options.content,
    placeholder: options.placeholder,
    editable: options.editable,
    onUpdate: (value) => {
      syncEditorValue({
        core: window.G7Core,
        name: options.name,
        locale: options.locale,
        value,
        multilingual: options.multilingual,
      });
    },
  });
  editorRegistry.set(options.containerId, options.locale, editor);
  ensureHtmlMode(core, options.name);
}

function mountMultilingualEditors(options: {
  shell: HTMLElement;
  containerId: string;
  name: string;
  content: Record<string, string>;
  placeholder: string;
  editable: boolean;
}): void {
  const core = window.G7Core;
  const locales = supportedLocales(core);
  const initialLocale = currentLocale(core);
  const tabs = document.createElement("div");
  tabs.className = "jwsoft-tiptap-locale-tabs";
  tabs.setAttribute("role", "tablist");
  const mounts = new Map<string, HTMLElement>();

  for (const locale of locales) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "jwsoft-tiptap-locale-tab";
    button.setAttribute("role", "tab");
    button.setAttribute("aria-selected", String(locale === initialLocale));
    button.textContent = LOCALE_LABELS[locale] ?? locale.toUpperCase();
    tabs.appendChild(button);

    const mount = document.createElement("div");
    mount.hidden = locale !== initialLocale;
    mounts.set(locale, mount);

    button.addEventListener("click", () => {
      for (const tab of tabs.querySelectorAll<HTMLButtonElement>("button")) {
        tab.setAttribute("aria-selected", String(tab === button));
      }
      for (const [candidate, candidateMount] of mounts) {
        candidateMount.hidden = candidate !== locale;
      }
      mountLocaleEditor({
        containerId: options.containerId,
        mount,
        name: options.name,
        locale,
        content: options.content[locale] ?? "",
        placeholder: options.placeholder,
        editable: options.editable,
        multilingual: true,
      });
    });
  }

  options.shell.appendChild(tabs);
  for (const mount of mounts.values()) options.shell.appendChild(mount);
  const initialMount = mounts.get(initialLocale);
  if (initialMount) {
    mountLocaleEditor({
      containerId: options.containerId,
      mount: initialMount,
      name: options.name,
      locale: initialLocale,
      content: options.content[initialLocale] ?? "",
      placeholder: options.placeholder,
      editable: options.editable,
      multilingual: true,
    });
  }
}

export async function initEditorHandler(
  action: G7Action,
  _context: unknown,
): Promise<void> {
  const params = paramsFrom(action);
  const name = params.name ?? "content";
  const containerId = editorContainerId(name);
  editorRegistry.destroy(containerId);

  const container = document.getElementById(containerId);
  if (!container) return;

  injectEditorStyles();
  if (hasConflictingEditorRuntime()) {
    renderFailure(
      container,
      "sirsoft-ckeditor5가 함께 로드되어 JWSoft Tiptap 에디터 시작을 차단했습니다.",
    );
    return;
  }

  const readOnly = booleanParam(params.readOnly);
  const disabled = booleanParam(params.disabled);
  const editable = isEditorWriteEnabled(readOnly, disabled);
  const shell = createShell(container, safeHeight(params.height));
  container.setAttribute("aria-disabled", String(disabled));
  container.setAttribute("aria-readonly", String(!editable));

  if (booleanParam(params.multilingual)) {
    mountMultilingualEditors({
      shell,
      containerId,
      name,
      content: resolveMultilingualContent(params, window.G7Core),
      placeholder: params.placeholder ?? "",
      editable,
    });
    return;
  }

  const mount = document.createElement("div");
  shell.appendChild(mount);
  mountLocaleEditor({
    containerId,
    mount,
    name,
    locale: currentLocale(window.G7Core),
    content: resolveSingleContent(params, window.G7Core),
    placeholder: params.placeholder ?? "",
    editable,
    multilingual: false,
  });
}
