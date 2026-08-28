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
import { editorText } from "@/editor/locale";
import { uploadEditorImage } from "@/editor/imageUpload";
import {
  insertMediaEmbed,
  normalizeMediaUrl,
  type MediaEmbedOptions,
} from "@/editor/mediaEmbed";
import { isEditorWriteEnabled } from "@/editor/runtimeGate";
import {
  createEditorToolbar,
  normalizeToolbarProfile,
  type ToolbarProfile,
} from "@/editor/toolbar";
import {
  ensureHtmlMode,
  setEditorPolicyAcknowledgement,
  syncEditorValue,
} from "@/editor/stateSync";
import type { G7Action, InitEditorParams } from "@/g7/types";
import type { Editor } from "@tiptap/core";
import { analyzeLegacyHtml, sanitizeClientHtml } from "@/policy/runtimePolicy";

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
    ? editorText(locale, "안전한 HTML 저장 정책 적용")
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

async function uploadImageFiles(options: {
  editor: Editor;
  files: File[];
  position: number;
  maxSizeMb: number;
  locale: string;
  status: HTMLElement;
}): Promise<void> {
  const files = options.files.slice(0, 20);
  let position = options.position;
  let completed = 0;
  options.status.dataset.tone = "neutral";

  try {
    for (const file of files) {
      options.status.textContent = editorText(
        options.locale,
        "이미지 {{current}}/{{total}} 업로드 중…",
        { current: completed + 1, total: files.length },
      );
      const uploaded = await uploadEditorImage(
        file,
        options.maxSizeMb,
        fetch,
        options.locale,
      );
      options.editor.commands.insertContentAt(position, {
        type: "image",
        attrs: {
          src: uploaded.url,
          alt: uploaded.originalName,
          jwClassTokens: "jw-image-block",
        },
      });
      position += 1;
      completed += 1;
    }
    options.status.dataset.tone = "success";
    options.status.textContent = editorText(
      options.locale,
      "이미지 {{count}}개를 업로드해 삽입했습니다.",
      { count: completed },
    );
  } catch (error) {
    options.status.dataset.tone = "warning";
    options.status.textContent =
      error instanceof Error
        ? error.message
        : editorText(options.locale, "이미지 업로드에 실패했습니다.");
  }
}

function renderLegacyWarning(options: {
  shell: HTMLElement;
  mount: HTMLElement;
  onContinue: () => void;
  locale: string;
}): void {
  const warning = document.createElement("div");
  warning.className = "jwsoft-tiptap-legacy-warning";
  warning.setAttribute("role", "alert");

  const message = document.createElement("div");
  message.textContent = editorText(
    options.locale,
    "기존 CKEditor 콘텐츠에 inline style·전용 class·지원하지 않는 HTML이 있습니다. 편집하거나 저장하면 서식이 달라질 수 있으며 자동 변환되지 않습니다. 원문을 유지하려면 읽기 전용을 선택하고, 전환 문제가 있으면 JWSoft를 비활성화한 뒤 CKEditor를 다시 활성화하십시오. 변경 결과를 확인하기 전에는 저장이 차단됩니다.",
  );
  warning.appendChild(message);

  const actions = document.createElement("div");
  actions.className = "jwsoft-tiptap-legacy-actions";

  const continueButton = document.createElement("button");
  continueButton.type = "button";
  continueButton.className = "jwsoft-tiptap-legacy-action";
  continueButton.dataset.primary = "true";
  continueButton.textContent = editorText(
    options.locale,
    "위험 확인 후 편집 계속",
  );
  continueButton.addEventListener("click", () => {
    options.onContinue();
    warning.remove();
  });

  const keepReadOnlyButton = document.createElement("button");
  keepReadOnlyButton.type = "button";
  keepReadOnlyButton.className = "jwsoft-tiptap-legacy-action";
  keepReadOnlyButton.textContent = editorText(options.locale, "읽기 전용 유지");
  keepReadOnlyButton.addEventListener("click", () => {
    keepReadOnlyButton.disabled = true;
    message.textContent = editorText(
      options.locale,
      "읽기 전용으로 유지했습니다. 변경을 승인하기 전에는 저장이 차단됩니다.",
    );
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
  toolbar: ToolbarProfile;
  imageUpload: boolean;
  dragDropImageUpload: boolean;
  pasteImageUpload: boolean;
  mediaEmbed: boolean;
  autoEmbedUrls: boolean;
  mediaOptions: MediaEmbedOptions;
  videoUpload: boolean;
  videoMaxSizeMb: number;
  imageMaxSizeMb: number;
  status: HTMLElement;
}): void {
  if (editorRegistry.has(options.containerId, options.locale)) return;
  const core = window.G7Core;
  options.mount.className = "jwsoft-tiptap-editor-frame";
  const editorMount = document.createElement("div");
  options.mount.appendChild(editorMount);
  let editor: Editor;
  const uploadAt = (files: File[], position: number): void => {
    void uploadImageFiles({
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
    onUpdate: (value) => {
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
    onMediaUrlPasted:
      options.editable && options.mediaEmbed && options.autoEmbedUrls
        ? (url) => {
            const media = normalizeMediaUrl(url, options.mediaOptions);
            return media ? insertMediaEmbed(editor, media) : false;
          }
        : undefined,
  });
  editorRegistry.set(options.containerId, options.locale, editor);

  if (!options.editable) return;

  const toolbar = createEditorToolbar({
    editor,
    profile: options.toolbar,
    imageUpload: options.imageUpload,
    imageMaxSizeMb: options.imageMaxSizeMb,
    mediaEmbed: options.mediaEmbed,
    mediaOptions: options.mediaOptions,
    videoUpload: options.videoUpload,
    videoMaxSizeMb: options.videoMaxSizeMb,
    locale: options.locale,
  });
  options.mount.insertBefore(toolbar, editorMount);

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
    shell: options.mount,
    mount: toolbar,
    locale: options.locale,
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
  toolbar: ToolbarProfile;
  imageUpload: boolean;
  dragDropImageUpload: boolean;
  pasteImageUpload: boolean;
  mediaEmbed: boolean;
  autoEmbedUrls: boolean;
  mediaOptions: MediaEmbedOptions;
  videoUpload: boolean;
  videoMaxSizeMb: number;
  imageMaxSizeMb: number;
  status: HTMLElement;
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
        toolbar: options.toolbar,
        imageUpload: options.imageUpload,
        dragDropImageUpload: options.dragDropImageUpload,
        pasteImageUpload: options.pasteImageUpload,
        mediaEmbed: options.mediaEmbed,
        autoEmbedUrls: options.autoEmbedUrls,
        mediaOptions: options.mediaOptions,
        videoUpload: options.videoUpload,
        videoMaxSizeMb: options.videoMaxSizeMb,
        imageMaxSizeMb: options.imageMaxSizeMb,
        status: options.status,
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
      toolbar: options.toolbar,
      imageUpload: options.imageUpload,
      dragDropImageUpload: options.dragDropImageUpload,
      pasteImageUpload: options.pasteImageUpload,
      mediaEmbed: options.mediaEmbed,
      autoEmbedUrls: options.autoEmbedUrls,
      mediaOptions: options.mediaOptions,
      videoUpload: options.videoUpload,
      videoMaxSizeMb: options.videoMaxSizeMb,
      imageMaxSizeMb: options.imageMaxSizeMb,
      status: options.status,
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
    const locale = currentLocale(window.G7Core);
    renderFailure(
      container,
      editorText(
        locale,
        "sirsoft-ckeditor5가 함께 로드되어 JWSoft Tiptap 에디터 시작을 차단했습니다.",
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
  const mediaOptions: MediaEmbedOptions = {
    youtube: booleanParam(params.youtubeEmbed),
    vimeo: booleanParam(params.vimeoEmbed),
    mp4: booleanParam(params.mp4Embed),
  };
  const videoUpload = booleanParam(params.videoUpload);
  const videoMaxSizeMb = safeVideoMaxSize(params.videoMaxSizeMb);
  const imageMaxSizeMb = safeImageMaxSize(params.imageMaxSizeMb);
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
      toolbar,
      imageUpload,
      dragDropImageUpload,
      pasteImageUpload,
      mediaEmbed,
      autoEmbedUrls,
      mediaOptions,
      videoUpload,
      videoMaxSizeMb,
      imageMaxSizeMb,
      status,
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
    content: resolveSingleContent(params, window.G7Core),
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
    videoUpload,
    videoMaxSizeMb,
    imageMaxSizeMb,
    status,
  });
}
