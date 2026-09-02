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
import { createEditorFooter } from "@/editor/editorFooter";
import { insertAutomaticUrl } from "@/editor/automaticUrl";
import { editorRegistry } from "@/editor/editorRegistry";
import { installFormSubmitGuard } from "@/editor/formSubmitGuard";
import { installEditorSaveSync } from "@/editor/saveSync";
import { socialOptions, type SocialOptions } from "@/editor/socialPolicy";
import { injectEditorStyles } from "@/editor/editorStyles";
import { editorText } from "@/editor/locale";
import { startImageUpload } from "@/editor/imageDropUpload";
import type { MediaEmbedOptions } from "@/editor/mediaEmbed";
import {
  mediaPlaybackOptions,
  type MediaPlaybackOptions,
} from "@/editor/mediaPlayer";
import { isEditorWriteEnabled } from "@/editor/runtimeGate";
import {
  createEditorToolbar,
  normalizeToolbarProfile,
  type ToolbarProfile,
} from "@/editor/toolbar";
import { ensureHtmlMode, syncEditorValue } from "@/editor/stateSync";
import type { G7Action, InitEditorParams } from "@/g7/types";
import type { Editor } from "@tiptap/core";
import { sanitizeClientHtml } from "@/policy/runtimePolicy";

import {
  createPolicyConsent,
  type PolicyConsent,
} from "@/editor/policyConsent";
import { configureLegacyEditing } from "@/editor/legacyWarning";

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

function safeImageMaxSize(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 2;
  return Math.min(10, Math.max(1, Math.floor(parsed)));
}

function safeVideoMaxSize(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 200;
  return Math.min(500, Math.max(1, Math.floor(parsed)));
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
  locale: string,
): { shell: HTMLElement; status: HTMLElement } {
  container.replaceChildren();
  container.style.setProperty("--jwsoft-tiptap-height", `${height}px`);
  const shell = document.createElement("div");
  shell.className = "jwsoft-tiptap-shell";
  const notice = document.createElement("div");
  notice.className = "jwsoft-tiptap-status";
  notice.setAttribute("role", "status");
  notice.dataset.tone = "neutral";
  notice.textContent = editable
    ? ""
    : editorText(locale, "이 편집기는 현재 읽기 전용입니다.");
  shell.appendChild(notice);
  container.appendChild(shell);
  return { shell, status: notice };
}

function showPasteLoss(status: HTMLElement, locale: string): void {
  status.dataset.tone = "warning";
  status.textContent = editorText(
    locale,
    "붙여넣기에서 지원하지 않는 서식을 제거했습니다. 필요하면 실행취소할 수 있습니다.",
  );
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
  toolbar: ToolbarProfile;
  imageUpload: boolean;
  dragDropImageUpload: boolean;
  pasteImageUpload: boolean;
  mediaEmbed: boolean;
  autoEmbedUrls: boolean;
  mediaOptions: MediaEmbedOptions;
  mediaPlayback: MediaPlaybackOptions;
  socialEmbeds: SocialOptions;
  videoUpload: boolean;
  videoMaxSizeMb: number;
  smartCards: boolean;
  autoSmartCards: boolean;
  imageMaxSizeMb: number;
  status: HTMLElement;
  consent: PolicyConsent;
}): void {
  if (editorRegistry.has(options.containerId, options.locale)) return;
  const core = window.G7Core;
  options.mount.replaceChildren();
  options.mount.className = "jwsoft-tiptap-editor-frame";
  const editorMount = document.createElement("div");
  options.mount.appendChild(editorMount);
  let editor: Editor;
  const uploadAt = (files: File[], position: number): void => {
    startImageUpload({
      editor,
      files,
      position,
      maxSizeMb: options.imageMaxSizeMb,
      locale: options.locale,
      status: options.status,
    });
  };
  editor = createEditor({
    element: editorMount,
    content: options.content,
    placeholder: options.placeholder,
    editable: false,
    mediaPlayback: options.mediaPlayback,
    socialEmbeds: options.socialEmbeds,
    onUpdate: (value) => {
      if (!editor.isEditable) return;
      syncEditorValue({
        core: window.G7Core,
        name: options.name,
        locale: options.locale,
        value: sanitizeClientHtml(value),
        multilingual: options.multilingual,
      });
    },
    onPasteSanitized: () => showPasteLoss(options.status, options.locale),
    onImageFilesDropped:
      options.editable && options.imageUpload && options.dragDropImageUpload
        ? uploadAt
        : undefined,
    onImageFilesPasted:
      options.editable && options.imageUpload && options.pasteImageUpload
        ? uploadAt
        : undefined,
    onPlainUrlPasted:
      options.editable &&
      ((options.mediaEmbed && options.autoEmbedUrls) ||
        (options.smartCards && options.autoSmartCards))
        ? (url, position, end) =>
            insertAutomaticUrl(editor, url, position, end, {
              media: options.mediaEmbed && options.autoEmbedUrls,
              cards: options.smartCards && options.autoSmartCards,
              mediaOptions: options.mediaOptions,
              locale: options.locale,
              status: options.status,
            })
        : undefined,
  });
  editorRegistry.set(options.containerId, options.locale, editor);
  installFormSubmitGuard(editor, options.status, options.locale);
  options.mount.append(createEditorFooter(editor, options.locale));

  if (!options.editable) return;

  installEditorSaveSync(editor, () =>
    syncEditorValue({
      core: window.G7Core,
      name: options.name,
      locale: options.locale,
      value: sanitizeClientHtml(editor.getHTML()),
      multilingual: options.multilingual,
    }),
  );

  const toolbar = createEditorToolbar({
    editor,
    profile: options.toolbar,
    imageUpload: options.imageUpload,
    imageMaxSizeMb: options.imageMaxSizeMb,
    mediaEmbed: options.mediaEmbed,
    mediaOptions: options.mediaOptions,
    videoUpload: options.videoUpload,
    videoMaxSizeMb: options.videoMaxSizeMb,
    smartCards: options.smartCards,
    locale: options.locale,
  });
  options.mount.insertBefore(toolbar, editorMount);

  ensureHtmlMode(core, options.name);
  configureLegacyEditing({ ...options, editor, toolbar });
}

function mountMultilingualEditors(options: {
  shell: HTMLElement;
  containerId: string;
  name: string;
  content: Record<string, string>;
  placeholder: string;
  editable: boolean;
  toolbar: ToolbarProfile;
  imageUpload: boolean;
  dragDropImageUpload: boolean;
  pasteImageUpload: boolean;
  mediaEmbed: boolean;
  autoEmbedUrls: boolean;
  mediaOptions: MediaEmbedOptions;
  mediaPlayback: MediaPlaybackOptions;
  socialEmbeds: SocialOptions;
  videoUpload: boolean;
  videoMaxSizeMb: number;
  smartCards: boolean;
  autoSmartCards: boolean;
  imageMaxSizeMb: number;
  status: HTMLElement;
  consent: PolicyConsent;
}): void {
  const core = window.G7Core;
  const locales = supportedLocales(core, options.content);
  const initialLocale = currentLocale(core);
  const tabs = document.createElement("div");
  tabs.className = "jwsoft-tiptap-locale-tabs";
  tabs.setAttribute("role", "tablist");
  const mounts = new Map<string, HTMLElement>();
  const contentByLocale = new Map(Object.entries(options.content));
  let activeLocale = initialLocale;

  const mountEditor = (locale: string): void => {
    const mount = mounts.get(locale);
    if (!mount) return;
    mountLocaleEditor({
      containerId: options.containerId,
      mount,
      name: options.name,
      locale,
      content: contentByLocale.get(locale) ?? "",
      placeholder: options.placeholder,
      editable: options.editable,
      multilingual: true,
      toolbar: options.toolbar,
      imageUpload: options.imageUpload,
      dragDropImageUpload: options.dragDropImageUpload,
      pasteImageUpload: options.pasteImageUpload,
      mediaEmbed: options.mediaEmbed,
      autoEmbedUrls: options.autoEmbedUrls,
      mediaOptions: options.mediaOptions,
      mediaPlayback: options.mediaPlayback,
      socialEmbeds: options.socialEmbeds,
      videoUpload: options.videoUpload,
      videoMaxSizeMb: options.videoMaxSizeMb,
      smartCards: options.smartCards,
      autoSmartCards: options.autoSmartCards,
      imageMaxSizeMb: options.imageMaxSizeMb,
      status: options.status,
      consent: options.consent,
    });
  };

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
      if (locale === activeLocale) return;
      const previousEditor = editorRegistry.get(
        options.containerId,
        activeLocale,
      );
      if (previousEditor?.isEditable) {
        const value = sanitizeClientHtml(previousEditor.getHTML());
        contentByLocale.set(activeLocale, value);
        syncEditorValue({
          core: window.G7Core,
          name: options.name,
          locale: activeLocale,
          value,
          multilingual: true,
        });
      }
      editorRegistry.destroyLocale(options.containerId, activeLocale);
      for (const tab of tabs.querySelectorAll<HTMLButtonElement>("button")) {
        tab.setAttribute("aria-selected", String(tab === button));
      }
      for (const [candidate, candidateMount] of mounts) {
        candidateMount.hidden = candidate !== locale;
      }
      activeLocale = locale;
      mountEditor(locale);
    });
  }

  options.shell.appendChild(tabs);
  for (const mount of mounts.values()) options.shell.appendChild(mount);
  mountEditor(initialLocale);
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
    const locale = currentLocale(window.G7Core);
    renderFailure(
      container,
      editorText(
        locale,
        "sirsoft-ckeditor5가 함께 로드되어 jw-editor 시작을 차단했습니다.",
      ),
    );
    return;
  }

  const readOnly = booleanParam(params.readOnly);
  const disabled = booleanParam(params.disabled);
  const editable = isEditorWriteEnabled(readOnly, disabled);
  const locale = currentLocale(window.G7Core);
  const { shell, status } = createShell(
    container,
    safeHeight(params.height),
    editable,
    locale,
  );
  const toolbar = normalizeToolbarProfile(params.toolbar);
  const imageUpload = booleanParam(params.imageUpload);
  const dragDropImageUpload = booleanParam(params.dragDropImageUpload);
  const pasteImageUpload = booleanParam(params.pasteImageUpload);
  const mediaEmbed = booleanParam(params.mediaEmbed);
  const autoEmbedUrls = booleanParam(params.autoEmbedUrls);
  const mediaPlayback = mediaPlaybackOptions(
    params.externalMediaLoadMode,
    params.mediaAutoplay,
  );
  const mediaOptions: MediaEmbedOptions = {
    youtube: booleanParam(params.youtubeEmbed),
    vimeo: booleanParam(params.vimeoEmbed),
    mp4: booleanParam(params.mp4Embed),
  };
  const videoUpload = booleanParam(params.videoUpload);
  const videoMaxSizeMb = safeVideoMaxSize(params.videoMaxSizeMb);
  const smartCards = booleanParam(params.smartCards);
  const autoSmartCards = booleanParam(params.autoSmartCards);
  const imageMaxSizeMb = safeImageMaxSize(params.imageMaxSizeMb);
  container.setAttribute("aria-disabled", String(disabled));
  container.setAttribute("aria-readonly", String(!editable));

  const multilingual = booleanParam(params.multilingual);
  const content = multilingual
    ? resolveMultilingualContent(params, window.G7Core)
    : { [locale]: resolveSingleContent(params, window.G7Core) };
  const consent = createPolicyConsent(window.G7Core, container, content);

  if (multilingual) {
    mountMultilingualEditors({
      shell,
      containerId,
      name,
      content,
      placeholder: params.placeholder ?? "",
      editable,
      toolbar,
      imageUpload,
      dragDropImageUpload,
      pasteImageUpload,
      mediaEmbed,
      autoEmbedUrls,
      mediaOptions,
      mediaPlayback,
      socialEmbeds: socialOptions({ ...params }),
      videoUpload,
      videoMaxSizeMb,
      smartCards,
      autoSmartCards,
      imageMaxSizeMb,
      status,
      consent,
    });
    return;
  }

  const mount = document.createElement("div");
  shell.appendChild(mount);
  mountLocaleEditor({
    containerId,
    mount,
    name,
    locale,
    content: content[locale] ?? "",
    placeholder: params.placeholder ?? "",
    editable,
    multilingual: false,
    toolbar,
    imageUpload,
    dragDropImageUpload,
    pasteImageUpload,
    mediaEmbed,
    autoEmbedUrls,
    mediaOptions,
    mediaPlayback,
    socialEmbeds: socialOptions({ ...params }),
    videoUpload,
    videoMaxSizeMb,
    smartCards,
    autoSmartCards,
    imageMaxSizeMb,
    status,
    consent,
  });
}
