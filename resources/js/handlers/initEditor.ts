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
import {
  ensureHtmlMode,
  setEditorPolicyAcknowledgement,
  syncEditorValue,
} from "@/editor/stateSync";
import type { G7Action, InitEditorParams } from "@/g7/types";
import { analyzeLegacyHtml } from "@/policy/runtimePolicy";

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

function createShell(
  container: HTMLElement,
  height: number,
  editable: boolean,
): HTMLElement {
  container.replaceChildren();
  container.style.setProperty("--jwsoft-tiptap-height", `${height}px`);
  const shell = document.createElement("div");
  shell.className = "jwsoft-tiptap-shell";
  const notice = document.createElement("div");
  notice.className = "jwsoft-tiptap-stage-notice";
  notice.setAttribute("role", "status");
  notice.textContent = editable
    ? "서버 canonical HTML 저장 정책이 적용됩니다."
    : "이 편집기는 현재 읽기 전용입니다.";
  shell.appendChild(notice);
  container.appendChild(shell);
  return shell;
}

function renderLegacyWarning(options: {
  shell: HTMLElement;
  mount: HTMLElement;
  onContinue: () => void;
}): void {
  const warning = document.createElement("div");
  warning.className = "jwsoft-tiptap-legacy-warning";
  warning.setAttribute("role", "alert");

  const message = document.createElement("div");
  message.textContent =
    "기존 HTML 중 지원하지 않는 태그·속성·서식이 있습니다. 변경 결과를 승인하기 전에는 저장이 차단됩니다.";
  warning.appendChild(message);

  const actions = document.createElement("div");
  actions.className = "jwsoft-tiptap-legacy-actions";

  const continueButton = document.createElement("button");
  continueButton.type = "button";
  continueButton.className = "jwsoft-tiptap-legacy-action";
  continueButton.dataset.primary = "true";
  continueButton.textContent = "변경 확인 후 편집 계속";
  continueButton.addEventListener("click", () => {
    options.onContinue();
    warning.remove();
  });

  const keepReadOnlyButton = document.createElement("button");
  keepReadOnlyButton.type = "button";
  keepReadOnlyButton.className = "jwsoft-tiptap-legacy-action";
  keepReadOnlyButton.textContent = "읽기 전용 유지";
  keepReadOnlyButton.addEventListener("click", () => {
    keepReadOnlyButton.disabled = true;
    message.textContent =
      "읽기 전용으로 유지했습니다. 변경을 승인하기 전에는 저장이 차단됩니다.";
  });

  actions.append(continueButton, keepReadOnlyButton);
  warning.appendChild(actions);
  options.shell.insertBefore(warning, options.mount);
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
    editable: false,
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

  if (!options.editable) return;

  ensureHtmlMode(core, options.name);
  const analysis = analyzeLegacyHtml(options.content, editor.getHTML());
  if (!analysis.hasLoss) {
    setEditorPolicyAcknowledgement(core, true);
    editor.setEditable(true);
    return;
  }

  setEditorPolicyAcknowledgement(core, false);
  document
    .getElementById(options.containerId)
    ?.setAttribute("aria-readonly", "true");
  renderLegacyWarning({
    shell: options.mount.parentElement ?? options.mount,
    mount: options.mount,
    onContinue: () => {
      setEditorPolicyAcknowledgement(window.G7Core, true);
      syncEditorValue({
        core: window.G7Core,
        name: options.name,
        locale: options.locale,
        value: analysis.canonicalEditorHtml,
        multilingual: options.multilingual,
      });
      editor.setEditable(true);
      document
        .getElementById(options.containerId)
        ?.setAttribute("aria-readonly", "false");
    },
  });
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
  const shell = createShell(container, safeHeight(params.height), editable);
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
