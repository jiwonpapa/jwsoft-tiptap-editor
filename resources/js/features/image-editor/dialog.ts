import type { Editor } from "@tiptap/core";
import { NodeSelection } from "@tiptap/pm/state";
import { createDialog, type DialogHandle } from "@/editor/dialog";
import { editorText } from "@/editor/locale";
import { uploadEditorImage } from "@/editor/imageUpload";
import {
  createEditedFile,
  imageEditorOutput,
} from "@/features/image-editor/editedFile";
import {
  loadManagedImage,
  type ManagedImageSource,
} from "@/features/image-editor/managedImage";
import { loadImageEditorVendor } from "@/features/image-editor/vendorLoader";
import type {
  ImageEditorInstance,
  ImageEditorVendor,
} from "@/features/image-editor/vendorTypes";

interface ImageTarget {
  position: number;
  source: string;
}

interface ImageEditorSession {
  instance: ImageEditorInstance;
  objectUrl: string;
  source: ManagedImageSource;
  target: ImageTarget;
}

interface DialogElements {
  content: HTMLElement;
  workspace: HTMLElement;
  status: HTMLElement;
  error: HTMLElement;
  cancel: HTMLButtonElement;
  save: HTMLButtonElement;
}

interface DialogState {
  generation: number;
  controller: AbortController | null;
  session: ImageEditorSession | null;
}

interface DialogContext {
  editor: Editor;
  locale: string;
  maxSizeMb: number;
  elements: DialogElements;
  handle: DialogHandle;
  state: DialogState;
}

const KOREAN_TRANSLATIONS = {
  loading: "불러오는 중…",
  resetOperations: "모든 편집 초기화",
  changesLoseWarningHint: "편집 내용을 모두 초기화하시겠습니까?",
  discardChangesWarningHint: "저장하지 않은 편집 내용을 버리시겠습니까?",
  cancel: "취소",
  confirm: "확인",
  discardChanges: "변경 버리기",
  undoTitle: "실행취소",
  redoTitle: "다시실행",
  showImageTitle: "원본 보기",
  adjustTab: "자르기·회전",
  finetuneTab: "보정",
  filtersTab: "필터",
  resizeTab: "크기",
  cropTool: "자르기",
  rotateTool: "회전",
  flipX: "좌우 반전",
  flipY: "상하 반전",
  brightnessTool: "밝기",
  contrastTool: "대비",
  warmthTool: "색온도",
  blurTool: "흐림",
  resizeWidthTitle: "너비(px)",
  resizeHeightTitle: "높이(px)",
  resetSize: "원본 크기로",
};

function selectedImage(editor: Editor): ImageTarget | null {
  const { selection } = editor.state;
  if (
    !(selection instanceof NodeSelection) ||
    selection.node.type.name !== "image"
  ) {
    return null;
  }
  const source = selection.node.attrs.src;
  return typeof source === "string"
    ? { position: selection.from, source }
    : null;
}

export function replaceSelectedImageSource(
  editor: Editor,
  target: ImageTarget,
  source: string,
): boolean {
  const node = editor.state.doc.nodeAt(target.position);
  if (node?.type.name !== "image" || node.attrs.src !== target.source)
    return false;
  const transaction = editor.state.tr.setNodeMarkup(
    target.position,
    undefined,
    {
      ...node.attrs,
      src: source,
    },
  );
  transaction.setSelection(
    NodeSelection.create(transaction.doc, target.position),
  );
  editor.view.dispatch(transaction);
  editor.commands.focus();
  return true;
}

function editorConfig(
  vendor: ImageEditorVendor,
  objectUrl: string,
  source: ManagedImageSource,
  locale: string,
  close: () => void,
): Record<string, unknown> {
  const tabs = vendor.TABS;
  const tools = vendor.TOOLS;
  const dark = document.documentElement.classList.contains("dark");
  return {
    source: objectUrl,
    tabsIds: [tabs.ADJUST, tabs.FINETUNE, tabs.FILTERS, tabs.RESIZE],
    defaultTabId: tabs.ADJUST,
    defaultToolId: tools.CROP,
    defaultSavedImageName: `${source.hash}-edited`,
    defaultSavedImageType: imageEditorOutput(source).editorExtension,
    defaultSavedImageQuality: imageEditorOutput(source).quality,
    savingPixelRatio: 1,
    previewPixelRatio: Math.min(window.devicePixelRatio || 1, 2),
    removeSaveButton: true,
    useBackendTranslations: false,
    translations: locale === "en" ? undefined : KOREAN_TRANSLATIONS,
    language: locale === "en" ? "en" : "ko",
    theme: dark
      ? {
          palette: {
            "bg-secondary": "#171a20",
            "bg-stateless": "#1b2028",
            "bg-primary": "#222831",
            "bg-primary-light": "#222831",
            "bg-primary-hover": "#2b3340",
            "bg-primary-active": "#293854",
            "bg-active": "#293854",
            "txt-primary": "#e5e9ef",
            "txt-secondary": "#aab4c2",
            "icon-primary": "#c6cfdb",
            "icons-secondary": "#9aa6b6",
            "borders-primary": "#465060",
            "borders-secondary": "#394150",
            "border-primary-stateless": "#465060",
            "btn-secondary-text": "#e5e9ef",
            "light-shadow": "rgba(0,0,0,.35)",
          },
          typography: { fontFamily: "inherit" },
        }
      : { typography: { fontFamily: "inherit" } },
    avoidChangesNotSavedAlertOnLeave: true,
    observePluginContainerSize: true,
    noCrossOrigin: true,
    onClose: close,
  };
}

function errorMessage(error: unknown, locale: string): string {
  if (error instanceof DOMException && error.name === "AbortError") return "";
  if (error instanceof Error) return error.message;
  return editorText(locale, "이미지 편집에 실패했습니다.");
}

function createDialogElements(locale: string): DialogElements {
  const content = document.createElement("div");
  content.className = "jwsoft-image-editor-module";
  const lead = document.createElement("p");
  lead.className = "jwsoft-image-editor-lead";
  lead.textContent = editorText(
    locale,
    "편집본은 새 이미지로 업로드하며 원본과 설명·배치 설정은 유지합니다.",
  );
  const workspace = document.createElement("div");
  workspace.className = "jwsoft-image-editor-workspace";
  const status = document.createElement("p");
  status.className = "jwsoft-image-editor-status";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  const error = document.createElement("p");
  error.className = "jwsoft-tiptap-dialog-error";
  error.setAttribute("role", "alert");
  error.hidden = true;
  const actions = document.createElement("div");
  actions.className =
    "jwsoft-tiptap-dialog-actions jwsoft-image-editor-actions";
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.textContent = locale === "en" ? "Cancel" : "취소";
  const save = document.createElement("button");
  save.type = "button";
  save.className = "jwsoft-tiptap-dialog-primary";
  save.textContent = locale === "en" ? "Save edited image" : "편집본 저장";
  save.disabled = true;
  actions.append(cancel, save);
  content.append(lead, workspace, status, error, actions);
  return { content, workspace, status, error, cancel, save };
}

function disposeSession(context: DialogContext): void {
  const { state, elements } = context;
  state.generation += 1;
  state.controller?.abort();
  state.controller = null;
  if (state.session) {
    state.session.instance.terminate();
    URL.revokeObjectURL(state.session.objectUrl);
    state.session = null;
  }
  elements.workspace.replaceChildren();
  elements.save.disabled = true;
}

function showError(context: DialogContext, caught: unknown): void {
  const message = errorMessage(caught, context.locale);
  if (!message) return;
  context.elements.error.textContent = message;
  context.elements.error.hidden = false;
  context.elements.status.textContent = "";
}

function waitForCanvas(workspace: HTMLElement): Promise<void> {
  if (workspace.querySelector("canvas")) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const observer = new MutationObserver(() => {
      if (!workspace.querySelector("canvas")) return;
      window.clearTimeout(timeout);
      observer.disconnect();
      resolve();
    });
    const timeout = window.setTimeout(() => {
      observer.disconnect();
      reject(new Error("이미지 편집 화면을 준비하지 못했습니다."));
    }, 10_000);
    observer.observe(workspace, { childList: true, subtree: true });
  });
}

async function openImageEditor(context: DialogContext): Promise<void> {
  disposeSession(context);
  const { editor, locale, elements, handle, state } = context;
  const current = state.generation;
  const target = selectedImage(editor);
  elements.error.hidden = true;
  elements.status.textContent =
    locale === "en"
      ? "Loading image editor…"
      : "이미지 편집 도구를 불러오는 중입니다…";
  if (!target) {
    showError(
      context,
      new Error(
        locale === "en"
          ? "Select an image first."
          : "먼저 이미지를 선택하세요.",
      ),
    );
    return;
  }
  try {
    const [vendor, source] = await Promise.all([
      loadImageEditorVendor(),
      loadManagedImage(target.source),
    ]);
    if (
      state.generation !== current ||
      !handle.element.open ||
      editor.isDestroyed
    )
      return;
    const objectUrl = URL.createObjectURL(source.blob);
    const instance = new vendor.Editor(
      elements.workspace,
      editorConfig(vendor, objectUrl, source, locale, () =>
        queueMicrotask(() => handle.close()),
      ),
    );
    state.session = { instance, objectUrl, source, target };
    instance.render();
    await waitForCanvas(elements.workspace);
    if (state.generation !== current || state.session?.instance !== instance)
      return;
    elements.status.textContent = "";
    elements.save.disabled = false;
  } catch (caught) {
    if (state.generation === current && handle.element.open)
      showError(context, caught);
  }
}

async function saveEditedImage(context: DialogContext): Promise<void> {
  const { editor, locale, maxSizeMb, elements, handle, state } = context;
  if (!state.session || state.controller) return;
  elements.error.hidden = true;
  const active = state.session;
  const output = imageEditorOutput(active.source);
  const exported = active.instance.getCurrentImgData(
    {
      name: `${active.source.hash}-edited`,
      extension: output.editorExtension,
      quality: output.quality,
    },
    1,
    true,
  );
  const upload = new AbortController();
  state.controller = upload;
  elements.save.disabled = true;
  let completed = false;
  try {
    const file = await createEditedFile(
      exported.imageData ?? {},
      active.source,
    );
    const uploaded = await uploadEditorImage(file, maxSizeMb, fetch, locale, {
      signal: upload.signal,
      onProgress: (percent) => {
        elements.status.textContent =
          locale === "en"
            ? `Uploading edited image… ${percent}%`
            : `편집본 업로드 중… ${percent}%`;
      },
    });
    if (!handle.element.open || editor.isDestroyed || state.session !== active)
      return;
    if (!replaceSelectedImageSource(editor, active.target, uploaded.url)) {
      throw new Error(
        locale === "en"
          ? "The selected image changed. The edited file was uploaded but was not inserted."
          : "선택 이미지가 바뀌어 편집본을 삽입하지 않았습니다. 업로드 파일은 이미지 관리에서 확인하세요.",
      );
    }
    completed = true;
  } catch (caught) {
    if (handle.element.open && state.session === active)
      showError(context, caught);
  } finally {
    exported.hideLoadingSpinner?.();
    if (state.controller === upload) state.controller = null;
    if (handle.element.open && state.session === active)
      elements.save.disabled = false;
  }
  if (completed) handle.close();
}

export function createImageEditorDialog(options: {
  editor: Editor;
  trigger: HTMLButtonElement;
  maxSizeMb: number;
  locale: string;
}): DialogHandle {
  const elements = createDialogElements(options.locale);
  const handle = createDialog({
    editor: options.editor,
    title: options.locale === "en" ? "Edit image" : "이미지 편집",
    trigger: options.trigger,
    content: elements.content,
    locale: options.locale,
  });
  handle.element.classList.add("jwsoft-image-editor-dialog");
  const context: DialogContext = {
    ...options,
    elements,
    handle,
    state: { generation: 0, controller: null, session: null },
  };

  options.trigger.addEventListener("click", () => {
    void openImageEditor(context).catch((caught: unknown) =>
      showError(context, caught),
    );
  });
  elements.cancel.addEventListener("click", () => handle.close());
  elements.save.addEventListener("click", () => {
    void saveEditedImage(context).catch((caught: unknown) =>
      showError(context, caught),
    );
  });
  handle.onClose(() => disposeSession(context));
  options.editor.on("destroy", () => disposeSession(context));
  return handle;
}
