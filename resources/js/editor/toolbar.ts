import type { Editor } from "@tiptap/core";

import {
  activeClassToken,
  type ClassTokenCategory,
} from "@/editor/classTokens";
import { EDITOR_POLICY } from "@/generated/editorPolicy";
import { createDialog, type DialogHandle } from "@/editor/dialog";
import { editorIcon, iconForLabel } from "@/editor/icons";
import { createImageUploadQueue } from "@/editor/imageUploadQueue";
import { createPopover } from "@/editor/popover";
import { installWritingTools } from "@/editor/writingTools";
import { labelMenuAction, menuField } from "@/editor/menuControls";
import { installResponsiveInsert } from "@/editor/responsiveToolbar";
import {
  DEFAULT_IMAGE_CLASS_TOKENS,
  imageClassTokens,
  type ImageAlignment,
  type ImageSize,
} from "@/editor/imageNode";
import { editorText } from "@/editor/locale";
import {
  insertMediaEmbed,
  normalizeMediaUrl,
  type MediaEmbedOptions,
} from "@/editor/mediaEmbed";
import { uploadEditorMedia } from "@/editor/mediaUpload";
import { fetchLinkPreview, insertSmartCard } from "@/editor/smartCard";
import { isAllowedEditorUrl } from "@/policy/runtimePolicy";

export const TOOLBAR_PROFILES = ["minimal", "standard", "full"] as const;
export type ToolbarProfile = (typeof TOOLBAR_PROFILES)[number];

interface ToolbarOptions {
  editor: Editor;
  profile: ToolbarProfile;
  imageUpload: boolean;
  imageMaxSizeMb: number;
  mediaEmbed: boolean;
  mediaOptions: MediaEmbedOptions;
  videoUpload: boolean;
  videoMaxSizeMb: number;
  smartCards: boolean;
  locale?: string;
}

interface ButtonOptions {
  label: string;
  title?: string;
  run: () => void;
  active?: () => boolean;
  enabled?: () => boolean;
}

const tokenLabels: Partial<Record<ClassTokenCategory, Record<string, string>>> =
  {
    textSize: {
      "jw-text-sm": "작게",
      "jw-text-base": "기본",
      "jw-text-lg": "크게",
      "jw-text-xl": "매우 크게",
    },
    alignment: {
      "jw-align-left": "왼쪽",
      "jw-align-center": "가운데",
      "jw-align-right": "오른쪽",
      "jw-align-justify": "양쪽 정렬",
    },
    indentation: {
      "jw-indent-1": "들여쓰기 1단계",
      "jw-indent-2": "들여쓰기 2단계",
      "jw-indent-3": "들여쓰기 3단계",
      "jw-indent-4": "들여쓰기 4단계",
    },
    spacing: {
      "jw-space-tight": "좁게",
      "jw-space-normal": "기본",
      "jw-space-relaxed": "넓게",
    },
    table: {
      "jw-table": "기본 표",
      "jw-table-striped": "줄무늬 표",
    },
    image: {
      "jw-image": "이미지",
      "jw-image-align-left": "왼쪽",
      "jw-image-align-center": "가운데",
      "jw-image-align-right": "오른쪽",
      "jw-image-size-25": "너비 25%",
      "jw-image-size-50": "너비 50%",
      "jw-image-size-75": "너비 75%",
      "jw-image-size-100": "너비 100%",
      "jw-image-inline": "글 안",
      "jw-image-block": "가운데 블록",
      "jw-image-rounded": "둥근 모서리",
    },
    media: {
      "jw-media": "미디어",
      "jw-media-16x9": "16:9",
      "jw-media-9x16": "9:16",
      "jw-media-youtube": "YouTube",
      "jw-media-vimeo": "Vimeo",
      "jw-media-mp4": "MP4",
      "jw-media-source": "미디어 주소",
    },
    card: {
      "jw-card": "링크 카드",
      "jw-card-generic": "일반 링크 카드",
      "jw-card-instagram": "Instagram 카드",
      "jw-card-x": "X 카드",
      "jw-card-tiktok": "TikTok 카드",
      "jw-card-facebook": "Facebook 카드",
      "jw-card-threads": "Threads 카드",
      "jw-card-link": "카드 주소",
      "jw-card-image": "카드 이미지",
    },
  };

export function normalizeToolbarProfile(value: unknown): ToolbarProfile {
  return TOOLBAR_PROFILES.includes(value as ToolbarProfile)
    ? (value as ToolbarProfile)
    : "standard";
}

function createButton(options: ButtonOptions): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "jwsoft-tiptap-tool";
  const icon = iconForLabel(options.label);
  if (icon) {
    button.append(editorIcon(icon));
    const label = document.createElement("span");
    label.className = "jwsoft-sr-only";
    label.textContent = options.label;
    button.append(label);
  } else button.textContent = options.label;
  button.dataset.tooltip = options.title ?? options.label;
  button.title = options.title ?? options.label;
  button.setAttribute("aria-label", options.title ?? options.label);
  if (options.active) button.setAttribute("aria-pressed", "false");
  button.addEventListener("click", options.run);
  Object.assign(button, {
    __jwsoftUpdate: (editable: boolean) => {
      button.disabled = !editable || !(options.enabled?.() ?? true);
      if (options.active) {
        button.setAttribute("aria-pressed", String(options.active()));
      }
    },
  });
  return button;
}

type UpdatableControl = HTMLElement & {
  __jwsoftUpdate?: (editable: boolean) => void;
};

function createGroup(label: string): HTMLElement {
  const group = document.createElement("div");
  group.className = "jwsoft-tiptap-tool-group";
  group.setAttribute("role", "group");
  group.setAttribute("aria-label", label);
  return group;
}

function createBlockSelect(editor: Editor, locale: string): HTMLSelectElement {
  const select = document.createElement("select");
  select.className = "jwsoft-tiptap-select";
  select.setAttribute("aria-label", editorText(locale, "문단 종류"));
  const blocks = [
    ["paragraph", "본문"],
    ["heading-2", "제목 2"],
    ["heading-3", "제목 3"],
    ["heading-4", "제목 4"],
    ["codeBlock", "코드 블록"],
  ] as const;
  for (const [value, label] of blocks) {
    select.add(new Option(editorText(locale, label), value));
  }
  select.addEventListener("change", () => {
    const chain = editor.chain().focus();
    if (select.value === "paragraph") chain.setParagraph().run();
    else if (select.value === "heading-2") chain.setHeading({ level: 2 }).run();
    else if (select.value === "heading-3") chain.setHeading({ level: 3 }).run();
    else if (select.value === "heading-4") chain.setHeading({ level: 4 }).run();
    else if (select.value === "codeBlock") chain.setCodeBlock().run();
  });
  Object.assign(select, {
    __jwsoftUpdate: (editable: boolean) => {
      select.disabled = !editable;
      if (editor.isActive("heading", { level: 2 })) select.value = "heading-2";
      else if (editor.isActive("heading", { level: 3 }))
        select.value = "heading-3";
      else if (editor.isActive("heading", { level: 4 }))
        select.value = "heading-4";
      else if (editor.isActive("codeBlock")) select.value = "codeBlock";
      else select.value = "paragraph";
    },
  });
  return select;
}

function createTokenSelect(
  editor: Editor,
  category: "textSize" | "alignment" | "spacing",
  label: string,
  locale: string,
): HTMLSelectElement {
  const select = document.createElement("select");
  select.className = "jwsoft-tiptap-select";
  select.setAttribute("aria-label", editorText(locale, label));
  select.add(new Option(editorText(locale, label), ""));
  for (const token of EDITOR_POLICY.classTokens[category]) {
    select.add(
      new Option(
        editorText(locale, tokenLabels[category]?.[token] ?? token),
        token,
      ),
    );
  }
  select.addEventListener("change", () => {
    editor
      .chain()
      .focus()
      .setClassToken(category, select.value || null)
      .run();
  });
  Object.assign(select, {
    __jwsoftUpdate: (editable: boolean) => {
      select.disabled = !editable;
      select.value = activeClassToken(editor, category) ?? "";
    },
  });
  return select;
}

function nextIndentationToken(
  editor: Editor,
  direction: 1 | -1,
): string | null | undefined {
  const tokens = EDITOR_POLICY.classTokens.indentation;
  const current = activeClassToken(editor, "indentation");
  const currentIndex = current
    ? (tokens as readonly string[]).indexOf(current)
    : -1;
  const nextIndex = currentIndex + direction;
  if (nextIndex < -1 || nextIndex >= tokens.length) return undefined;
  return nextIndex === -1 ? null : tokens[nextIndex];
}

function canChangeIndentation(editor: Editor, direction: 1 | -1): boolean {
  if (editor.isActive("listItem")) {
    return direction === 1
      ? editor.can().sinkListItem("listItem")
      : editor.can().liftListItem("listItem");
  }
  const token = nextIndentationToken(editor, direction);
  return (
    token !== undefined && editor.can().setClassToken("indentation", token)
  );
}

function changeIndentation(editor: Editor, direction: 1 | -1): boolean {
  if (editor.isActive("listItem")) {
    return direction === 1
      ? editor.chain().focus().sinkListItem("listItem").run()
      : editor.chain().focus().liftListItem("listItem").run();
  }
  const token = nextIndentationToken(editor, direction);
  if (token === undefined) return false;
  return editor.chain().focus().setClassToken("indentation", token).run();
}

function formField(
  labelText: string,
  input: HTMLInputElement | HTMLSelectElement,
): HTMLElement {
  const label = document.createElement("label");
  label.className = "jwsoft-tiptap-field";
  const text = document.createElement("span");
  text.textContent = labelText;
  label.append(text, input);
  return label;
}

function formError(): HTMLElement {
  const error = document.createElement("div");
  error.className = "jwsoft-tiptap-dialog-error";
  error.setAttribute("role", "alert");
  error.hidden = true;
  return error;
}

function createLinkDialog(
  editor: Editor,
  trigger: HTMLButtonElement,
  locale: string,
): DialogHandle {
  const form = document.createElement("form");
  form.className = "jwsoft-tiptap-dialog-form";
  const href = document.createElement("input");
  href.type = "text";
  href.inputMode = "url";
  href.placeholder =
    locale === "en"
      ? "https://example.com or /path"
      : "https://example.com 또는 /경로";
  const title = document.createElement("input");
  title.type = "text";
  const blank = document.createElement("input");
  blank.type = "checkbox";
  const blankLabel = formField(editorText(locale, "새 창에서 열기"), blank);
  blankLabel.classList.add("jwsoft-tiptap-field-inline");
  const error = formError();
  const actions = document.createElement("div");
  actions.className = "jwsoft-tiptap-dialog-actions";
  const apply = document.createElement("button");
  apply.type = "submit";
  apply.className = "jwsoft-tiptap-dialog-primary";
  apply.textContent = editorText(locale, "링크 적용");
  const remove = document.createElement("button");
  remove.type = "button";
  remove.textContent = editorText(locale, "링크 해제");
  actions.append(apply, remove);
  form.append(
    formField(editorText(locale, "주소"), href),
    formField(editorText(locale, "설명"), title),
    blankLabel,
    error,
    actions,
  );

  trigger.addEventListener("click", () => {
    const attributes = editor.getAttributes("link");
    href.value = typeof attributes.href === "string" ? attributes.href : "";
    title.value = typeof attributes.title === "string" ? attributes.title : "";
    blank.checked = attributes.target === "_blank";
    error.hidden = true;
  });
  const handle = createDialog({
    editor,
    title: editorText(locale, "링크"),
    trigger,
    content: form,
    locale,
    compact: true,
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const value = href.value.trim();
    if (!isAllowedEditorUrl(value)) {
      error.textContent = editorText(
        locale,
        "https, mailto, tel 또는 상대 경로만 사용할 수 있습니다.",
      );
      error.hidden = false;
      href.focus();
      return;
    }
    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({
        href: value,
        title: title.value.trim() || null,
        target: blank.checked ? "_blank" : null,
        rel: blank.checked ? "noopener noreferrer" : null,
      })
      .run();
    handle.close();
  });
  remove.addEventListener("click", () => {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    handle.close();
  });
  return handle;
}

function createTableDialog(
  editor: Editor,
  trigger: HTMLButtonElement,
  locale: string,
): DialogHandle {
  const form = document.createElement("form");
  form.className = "jwsoft-tiptap-dialog-form";
  const rows = document.createElement("input");
  rows.type = "number";
  rows.min = "1";
  rows.max = "20";
  rows.value = "3";
  const columns = document.createElement("input");
  columns.type = "number";
  columns.min = "1";
  columns.max = "20";
  columns.value = "3";
  const error = formError();
  const apply = document.createElement("button");
  apply.type = "submit";
  apply.className = "jwsoft-tiptap-dialog-primary";
  apply.textContent = editorText(locale, "표 삽입");
  form.append(
    formField(editorText(locale, "행"), rows),
    formField(editorText(locale, "열"), columns),
    error,
    apply,
  );
  const handle = createDialog({
    editor,
    title: editorText(locale, "표 만들기"),
    trigger,
    content: form,
    locale,
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const rowCount = Number(rows.value);
    const columnCount = Number(columns.value);
    if (
      !Number.isInteger(rowCount) ||
      !Number.isInteger(columnCount) ||
      rowCount < 1 ||
      columnCount < 1 ||
      rowCount > 20 ||
      columnCount > 20
    ) {
      error.textContent = editorText(
        locale,
        "행과 열은 각각 1~20 사이여야 합니다.",
      );
      error.hidden = false;
      return;
    }
    editor
      .chain()
      .focus()
      .insertTable({ rows: rowCount, cols: columnCount, withHeaderRow: true })
      .setClassToken("table", "jw-table")
      .run();
    handle.close();
  });
  return handle;
}

function createImageDialog(
  editor: Editor,
  trigger: HTMLButtonElement,
  uploadEnabled: boolean,
  maxSizeMb: number,
  locale: string,
): DialogHandle {
  const en = locale === "en";
  const form = document.createElement("form");
  form.className = "jwsoft-tiptap-dialog-form jwsoft-image-form";
  const tabs = document.createElement("div");
  tabs.className = "jwsoft-dialog-tabs";
  tabs.setAttribute("role", "tablist");
  const fileTab = document.createElement("button");
  fileTab.type = "button";
  fileTab.setAttribute("role", "tab");
  fileTab.textContent = en ? "Upload" : "파일 업로드";
  const urlTab = document.createElement("button");
  urlTab.type = "button";
  urlTab.setAttribute("role", "tab");
  urlTab.textContent = en ? "From URL" : "주소로 삽입";
  if (uploadEnabled) tabs.append(fileTab);
  tabs.append(urlTab);
  const urlPanel = document.createElement("div");
  urlPanel.className = "jwsoft-image-url-panel";
  const src = document.createElement("input");
  src.type = "text";
  src.inputMode = "url";
  src.placeholder = "https://example.com/image.webp";
  const preview = document.createElement("img");
  preview.className = "jwsoft-image-preview";
  preview.alt = en ? "Image preview" : "이미지 미리보기";
  preview.hidden = true;
  src.addEventListener("change", () => {
    preview.hidden = !isAllowedEditorUrl(src.value.trim(), true);
    if (!preview.hidden) preview.src = src.value.trim();
  });
  urlPanel.append(
    formField(
      editorText(locale, uploadEnabled ? "또는 이미지 주소" : "이미지 주소"),
      src,
    ),
    preview,
  );
  const alt = document.createElement("input");
  alt.type = "text";
  const title = document.createElement("input");
  title.type = "text";
  const caption = document.createElement("input");
  caption.type = "text";
  const alignment = document.createElement("select");
  alignment.setAttribute("aria-label", editorText(locale, "이미지 정렬"));
  for (const [value, label] of [
    ["left", "왼쪽"],
    ["center", "가운데"],
    ["right", "오른쪽"],
  ])
    alignment.add(new Option(editorText(locale, label), value));
  const size = document.createElement("select");
  size.setAttribute("aria-label", editorText(locale, "이미지 크기"));
  for (const value of Array.from({ length: 19 }, (_, index) =>
    String(10 + index * 5),
  ))
    size.add(new Option(value + "%", value));
  alignment.value = "center";
  size.value = "100";
  const details = document.createElement("details");
  details.className = "jwsoft-image-details";
  const summary = document.createElement("summary");
  summary.textContent = en ? "Description & layout" : "이미지 설명 · 배치";
  const fields = document.createElement("div");
  fields.className = "jwsoft-detail-grid";
  fields.append(
    formField(editorText(locale, "대체 텍스트"), alt),
    formField(editorText(locale, "캡션"), caption),
    formField(editorText(locale, "제목"), title),
    formField(editorText(locale, "이미지 정렬"), alignment),
    formField(editorText(locale, "이미지 크기"), size),
  );
  details.append(summary, fields);
  const error = formError();
  const actions = document.createElement("div");
  actions.className = "jwsoft-tiptap-dialog-actions";
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.textContent = en ? "Cancel" : "취소";
  const apply = document.createElement("button");
  apply.type = "submit";
  apply.className = "jwsoft-tiptap-dialog-primary";
  apply.textContent = editorText(locale, "이미지 삽입");
  actions.append(cancel, apply);
  const queue = createImageUploadQueue({
    maxSizeMb,
    locale,
    onChange: () => {
      refreshImageAction();
    },
  });
  let mode: "file" | "url" = uploadEnabled ? "file" : "url";
  const refreshImageAction = () => {
    apply.disabled = queue.busy || (mode === "file" && queue.count === 0);
    apply.textContent = queue.busy
      ? en
        ? "Uploading…"
        : "업로드 중…"
      : mode === "file" && !queue.ready
        ? en
          ? "Upload & insert"
          : "업로드 후 삽입"
        : editorText(locale, editing ? "이미지 적용" : "이미지 삽입");
  };
  const selectMode = (value: "file" | "url") => {
    mode = value;
    queue.element.hidden = mode !== "file";
    urlPanel.hidden = mode !== "url";
    fileTab.setAttribute("aria-selected", String(mode === "file"));
    urlTab.setAttribute("aria-selected", String(mode === "url"));
    if (mode === "url") src.focus();
    refreshImageAction();
  };
  fileTab.addEventListener("click", () => selectMode("file"));
  urlTab.addEventListener("click", () => selectMode("url"));
  form.append(tabs);
  if (uploadEnabled) form.append(queue.element);
  form.append(urlPanel, details, error, actions);
  const handle = createDialog({
    editor,
    title: editorText(locale, "이미지"),
    trigger,
    content: form,
    locale,
  });
  cancel.addEventListener("click", () => handle.close());
  handle.onClose(() => queue.cancel());
  editor.on("destroy", () => queue.destroy());
  let editing = false;
  trigger.addEventListener("click", () => {
    editing = editor.isActive("image");
    const attributes = editing ? editor.getAttributes("image") : {};
    src.value = typeof attributes.src === "string" ? attributes.src : "";
    alt.value = typeof attributes.alt === "string" ? attributes.alt : "";
    title.value = typeof attributes.title === "string" ? attributes.title : "";
    caption.value =
      typeof attributes.caption === "string" ? attributes.caption : "";
    const tokens = String(attributes.jwClassTokens ?? "");
    alignment.value =
      ["left", "center", "right"].find((value) =>
        tokens.includes("jw-image-align-" + value),
      ) ?? "center";
    size.value = /jw-image-size-(\d+)/.exec(tokens)?.[1] ?? "100";
    details.open = editing;
    error.hidden = true;
    selectMode(editing || !uploadEnabled ? "url" : "file");
    preview.hidden = !editing;
    if (editing) preview.src = src.value;
    refreshImageAction();
    if (uploadEnabled) queue.mountNative();
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    error.hidden = true;
    if (queue.busy) return;
    let sources: Array<{ url: string }> = [{ url: src.value.trim() }];
    if (mode === "file") {
      if (!queue.count) {
        error.textContent = en
          ? "Choose images first."
          : "먼저 이미지를 선택하세요.";
        error.hidden = false;
        return;
      }
      if (editing && queue.count !== 1) {
        error.textContent = en
          ? "Choose one replacement image."
          : "교체할 이미지는 한 장만 선택하세요.";
        error.hidden = false;
        return;
      }
      apply.disabled = true;
      const result = await queue.uploadAll();
      apply.disabled = false;
      if (!handle.element.open || editor.isDestroyed) return;
      if (!result) return;
      sources = result;
    } else if (!isAllowedEditorUrl(src.value.trim(), true)) {
      error.textContent = editorText(
        locale,
        "https 또는 상대 경로 이미지만 사용할 수 있습니다.",
      );
      error.hidden = false;
      src.focus();
      return;
    }
    const attributes = (url: string) => ({
      src: url,
      alt: alt.value.trim(),
      title: title.value.trim() || null,
      caption: caption.value.trim(),
      jwClassTokens: imageClassTokens(
        alignment.value as ImageAlignment,
        size.value as ImageSize,
        editing
          ? editor.getAttributes("image").jwClassTokens
          : DEFAULT_IMAGE_CLASS_TOKENS,
      ),
    });
    if (editing)
      editor
        .chain()
        .focus()
        .updateAttributes("image", attributes(sources[0].url))
        .run();
    else
      editor
        .chain()
        .focus()
        .insertContent(
          sources.flatMap(({ url }) => [
            { type: "image", attrs: attributes(url) },
            { type: "paragraph" },
          ]),
        )
        .run();
    queue.clear();
    form.reset();
    handle.close();
  });
  selectMode(mode);
  return handle;
}

function createMediaDialog(
  editor: Editor,
  trigger: HTMLButtonElement,
  allowed: MediaEmbedOptions,
  uploadEnabled: boolean,
  maxSizeMb: number,
  locale: string,
): DialogHandle {
  const form = document.createElement("form");
  form.className = "jwsoft-tiptap-dialog-form jwsoft-media-form";
  const url = document.createElement("input");
  url.type = "url";
  url.inputMode = "url";
  url.placeholder = "https://youtube.com/… / vimeo.com/… / video.mp4";
  const file = document.createElement("input");
  file.type = "file";
  file.accept = "video/mp4,.mp4";
  file.className = "jwsoft-sr-only";
  file.setAttribute("aria-label", editorText(locale, "MP4 파일"));
  let mode: "url" | "file" = "url";
  let selectedFile: File | undefined;
  let controller: AbortController | null = null;
  const urlPanel = formField(editorText(locale, "동영상 URL"), url);
  const filePanel = document.createElement("div");
  filePanel.hidden = true;
  const dropzone = document.createElement("button");
  dropzone.type = "button";
  dropzone.className = "jwsoft-upload-dropzone";
  const dropTitle = document.createElement("strong");
  dropTitle.textContent =
    locale === "en"
      ? "Drop an MP4 here or choose a file"
      : "MP4를 끌어놓거나 파일을 선택하세요";
  const hint = document.createElement("span");
  hint.textContent =
    locale === "en"
      ? `MP4 · up to ${maxSizeMb} MB`
      : `MP4 · 최대 ${maxSizeMb}MB`;
  dropzone.append(editorIcon("upload"), dropTitle, hint);
  const fileName = document.createElement("p");
  fileName.className = "jwsoft-video-file-name";
  const selectFile = (selected?: File) => {
    selectedFile = selected;
    fileName.textContent = selected
      ? `${selected.name} · ${(selected.size / 1024 / 1024).toFixed(1)} MB`
      : "";
    refreshVideoAction();
  };
  dropzone.addEventListener("click", () => file.click());
  file.addEventListener("change", () => selectFile(file.files?.[0]));
  dropzone.addEventListener("dragover", (event) => {
    event.preventDefault();
    dropzone.dataset.dragging = "true";
  });
  dropzone.addEventListener("dragleave", () => {
    delete dropzone.dataset.dragging;
  });
  dropzone.addEventListener("drop", (event) => {
    event.preventDefault();
    delete dropzone.dataset.dragging;
    if (!controller) selectFile(event.dataTransfer?.files[0]);
  });
  filePanel.append(file, dropzone, fileName);
  const progress = document.createElement("div");
  progress.className = "jwsoft-tiptap-upload-status";
  progress.setAttribute("role", "status");
  progress.setAttribute("aria-live", "polite");
  progress.hidden = true;
  const progressLabel = document.createElement("strong");
  const progressBar = document.createElement("progress");
  progressBar.max = 100;
  progressBar.setAttribute(
    "aria-label",
    locale === "en" ? "Video upload progress" : "동영상 업로드 진행률",
  );
  const progressBytes = document.createElement("span");
  progress.append(progressLabel, progressBar, progressBytes);
  progress.classList.add("jwsoft-video-progress");
  const error = formError();
  const apply = document.createElement("button");
  apply.type = "submit";
  apply.className = "jwsoft-tiptap-dialog-primary";
  apply.textContent = editorText(locale, "동영상 삽입");
  const refreshVideoAction = () => {
    apply.disabled = Boolean(controller) || (mode === "file" && !selectedFile);
    apply.textContent = controller
      ? locale === "en"
        ? "Uploading…"
        : "업로드 중…"
      : mode === "file"
        ? locale === "en"
          ? "Upload & insert"
          : "업로드 후 삽입"
        : editorText(locale, "동영상 삽입");
  };
  const tabs = document.createElement("div");
  tabs.className = "jwsoft-dialog-tabs";
  tabs.setAttribute("role", "tablist");
  tabs.setAttribute(
    "aria-label",
    locale === "en" ? "Video source" : "동영상 입력 방식",
  );
  if (uploadEnabled) {
    for (const [value, label] of [
      ["url", locale === "en" ? "Video URL" : "동영상 주소"],
      ["file", locale === "en" ? "Upload MP4" : "MP4 업로드"],
    ] as const) {
      const tab = document.createElement("button");
      tab.type = "button";
      tab.role = "tab";
      tab.textContent = label;
      tab.setAttribute("aria-selected", String(mode === value));
      tab.addEventListener("click", () => {
        if (controller) return;
        mode = value;
        urlPanel.hidden = mode !== "url";
        url.disabled = mode !== "url";
        filePanel.hidden = mode !== "file";
        for (const other of tabs.querySelectorAll("button"))
          other.setAttribute("aria-selected", String(other === tab));
        error.hidden = true;
        refreshVideoAction();
      });
      tabs.append(tab);
    }
    form.append(tabs);
  }
  const actions = document.createElement("div");
  actions.className = "jwsoft-tiptap-dialog-actions";
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.textContent = locale === "en" ? "Cancel" : "취소";
  actions.append(cancel, apply);
  form.append(urlPanel, filePanel, progress, error, actions);
  const handle = createDialog({
    editor,
    title: editorText(locale, "동영상"),
    trigger,
    content: form,
    locale,
  });
  cancel.addEventListener("click", () => handle.close());
  handle.onClose(() => {
    controller?.abort();
    controller = null;
    apply.disabled = false;
    file.disabled = false;
    dropzone.disabled = false;
    progress.hidden = true;
    refreshVideoAction();
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (controller) return;
    error.hidden = true;
    let value = url.value;
    const selected = mode === "file" ? selectedFile : undefined;
    if (mode === "file" && !selected) {
      error.textContent =
        locale === "en" ? "Choose an MP4 file." : "MP4 파일을 선택하세요.";
      error.hidden = false;
      return;
    }
    if (selected && uploadEnabled) {
      const request = new AbortController();
      controller = request;
      refreshVideoAction();
      apply.disabled = true;
      file.disabled = true;
      dropzone.disabled = true;
      progress.hidden = false;
      try {
        const uploaded = await uploadEditorMedia(selected, {
          maxSizeMb,
          locale,
          signal: request.signal,
          onProgress: (completed, total) => {
            if (request.signal.aborted) return;
            const percent = Math.min(
              100,
              Math.floor((completed / total) * 100),
            );
            progressLabel.textContent = `${locale === "en" ? "Uploading" : "업로드 중"} ${percent}%`;
            progressBar.value = percent;
            progressBytes.textContent = `${(completed / 1024 / 1024).toFixed(1)} / ${(total / 1024 / 1024).toFixed(1)} MB`;
          },
          onPhase: (phase) => {
            if (request.signal.aborted) return;
            progressLabel.textContent =
              phase === "starting"
                ? locale === "en"
                  ? "Preparing upload…"
                  : "업로드 준비 중…"
                : phase === "processing"
                  ? locale === "en"
                    ? "Processing video…"
                    : "업로드 완료 · 영상 확인 중…"
                  : locale === "en"
                    ? "Uploading…"
                    : "업로드 중…";
            if (phase === "starting") {
              progressBar.value = 0;
              progressBytes.textContent = "";
            }
          },
        });
        if (
          request.signal.aborted ||
          !handle.element.open ||
          editor.isDestroyed
        )
          return;
        value = uploaded.url;
      } catch (uploadError) {
        if (
          request.signal.aborted ||
          !handle.element.open ||
          editor.isDestroyed
        )
          return;
        error.textContent =
          uploadError instanceof Error
            ? uploadError.message
            : editorText(locale, "동영상 업로드에 실패했습니다.");
        error.hidden = false;
        file.disabled = false;
        apply.disabled = false;
        file.focus();
        return;
      } finally {
        if (controller === request) {
          controller = null;
          apply.disabled = false;
          file.disabled = false;
          dropzone.disabled = false;
          refreshVideoAction();
        }
      }
    }
    const media = normalizeMediaUrl(value, allowed);
    if (!media) {
      error.textContent = editorText(
        locale,
        "허용된 YouTube·Vimeo·MP4 URL을 입력하십시오.",
      );
      error.hidden = false;
      url.focus();
      return;
    }
    if (selected) media.title = selected.name;
    insertMediaEmbed(editor, media);
    selectFile();
    form.reset();
    progress.hidden = true;
    file.disabled = false;
    apply.disabled = false;
    error.hidden = true;
    handle.close();
  });
  return handle;
}

function createSmartCardDialog(
  editor: Editor,
  trigger: HTMLButtonElement,
  locale: string,
): DialogHandle {
  const form = document.createElement("form");
  form.className = "jwsoft-tiptap-dialog-form";
  const url = document.createElement("input");
  url.type = "url";
  url.inputMode = "url";
  url.placeholder = "https://example.com/post";
  const progress = document.createElement("div");
  progress.className = "jwsoft-tiptap-upload-status";
  progress.setAttribute("role", "status");
  progress.hidden = true;
  const error = formError();
  const apply = document.createElement("button");
  apply.type = "submit";
  apply.className = "jwsoft-tiptap-dialog-primary";
  apply.textContent = editorText(locale, "링크 카드 삽입");
  form.append(
    formField(editorText(locale, "HTTPS 주소"), url),
    progress,
    error,
    apply,
  );
  const handle = createDialog({
    editor,
    title: editorText(locale, "링크 카드"),
    trigger,
    content: form,
    locale,
    compact: true,
  });
  let controller: AbortController | null = null;
  handle.onClose(() => {
    controller?.abort();
    controller = null;
    apply.disabled = false;
    progress.hidden = true;
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (controller) return;
    const request = new AbortController();
    controller = request;
    error.hidden = true;
    progress.hidden = false;
    progress.textContent = editorText(
      locale,
      "링크 미리보기를 가져오는 중입니다…",
    );
    apply.disabled = true;
    try {
      const preview = await fetchLinkPreview(
        url.value,
        fetch,
        locale,
        request.signal,
      );
      if (request.signal.aborted || !handle.element.open || editor.isDestroyed)
        return;
      insertSmartCard(editor, preview);
      form.reset();
      progress.hidden = true;
      handle.close();
    } catch (previewError) {
      if (request.signal.aborted || !handle.element.open || editor.isDestroyed)
        return;
      error.textContent =
        previewError instanceof Error
          ? previewError.message
          : editorText(locale, "링크 미리보기를 가져오지 못했습니다.");
      error.hidden = false;
      progress.hidden = true;
      url.focus();
    } finally {
      if (controller === request) {
        controller = null;
        apply.disabled = false;
      }
    }
  });

  return handle;
}

function installRovingKeyboard(toolbar: HTMLElement): void {
  const controls = () =>
    [
      ...toolbar.querySelectorAll<HTMLElement>(
        "button:not(:disabled), select:not(:disabled)",
      ),
    ].filter(
      (element) =>
        !element.closest("[hidden]") &&
        getComputedStyle(element).display !== "none",
    );
  const refresh = () => {
    const enabled = controls();
    const active =
      enabled.find((item) => item === document.activeElement) ??
      enabled.find((item) => item.tabIndex === 0) ??
      enabled[0];
    for (const item of toolbar.querySelectorAll<HTMLElement>("button, select"))
      item.tabIndex = item === active ? 0 : -1;
  };
  toolbar.addEventListener("jwsoft-controls-updated", refresh);
  toolbar.addEventListener("focusin", refresh);
  toolbar.addEventListener("keydown", (event) => {
    if (
      !(event.target instanceof HTMLButtonElement) ||
      !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
    )
      return;
    const enabled = controls(),
      current = enabled.indexOf(event.target);
    if (current < 0 || !enabled.length) return;
    event.preventDefault();
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? enabled.length - 1
          : (current + (event.key === "ArrowRight" ? 1 : -1) + enabled.length) %
            enabled.length;
    enabled[next].focus();
    refresh();
  });
}

export function createEditorToolbar(options: ToolbarOptions): HTMLElement {
  const { editor, profile } = options;
  const locale = options.locale ?? "ko";
  const t = (value: string) => editorText(locale, value);
  const region = document.createElement("div");
  region.className = "jwsoft-tiptap-toolbar-region";
  const toolbar = document.createElement("div");
  toolbar.className = "jwsoft-tiptap-toolbar";
  toolbar.setAttribute("role", "toolbar");
  toolbar.setAttribute("aria-label", `${profile} ${t("편집 도구")}`);
  region.appendChild(toolbar);
  const controls: UpdatableControl[] = [];
  const dialogs: DialogHandle[] = [];

  const add = (group: HTMLElement, control: UpdatableControl) => {
    group.appendChild(control);
    controls.push(control);
  };
  const addGroup = (label: string) => {
    const group = createGroup(label);
    toolbar.appendChild(group);
    return group;
  };

  const block = addGroup(t("문단"));
  add(block, createBlockSelect(editor, locale));

  const inline = addGroup(t("글자 서식"));
  add(
    inline,
    createButton({
      label: t("굵게"),
      title: t("굵게 (Ctrl/Command+B)"),
      run: () => void editor.chain().focus().toggleBold().run(),
      active: () => editor.isActive("bold"),
    }),
  );
  add(
    inline,
    createButton({
      label: t("기울임"),
      title: t("기울임 (Ctrl/Command+I)"),
      run: () => void editor.chain().focus().toggleItalic().run(),
      active: () => editor.isActive("italic"),
    }),
  );
  add(
    inline,
    createButton({
      label: t("밑줄"),
      title: t("밑줄 (Ctrl/Command+U)"),
      run: () => void editor.chain().focus().toggleUnderline().run(),
      active: () => editor.isActive("underline"),
    }),
  );
  const menus: ReturnType<typeof createPopover>[] = [];
  const menu = (label: string, icon: Parameters<typeof createPopover>[1]) => {
    const handle = createPopover(label, icon, {
      editor,
      locale,
      sheet: icon !== "more",
    });
    menus.push(handle);
    toolbar.append(handle.trigger);
    region.append(handle.panel);
    return handle;
  };
  if (profile !== "minimal") {
    const lists = menu(locale === "en" ? "Lists" : "목록", "list");
    add(
      lists.panel,
      labelMenuAction(
        createButton({
          label: t("목록"),
          title: t("글머리 목록"),
          run: () => void editor.chain().focus().toggleBulletList().run(),
          active: () => editor.isActive("bulletList"),
        }),
      ),
    );
    add(
      lists.panel,
      labelMenuAction(
        createButton({
          label: t("번호"),
          title: t("번호 목록"),
          run: () => void editor.chain().focus().toggleOrderedList().run(),
          active: () => editor.isActive("orderedList"),
        }),
      ),
    );
    add(
      lists.panel,
      labelMenuAction(
        createButton({
          label: locale === "en" ? "Checklist" : "체크리스트",
          run: () =>
            void editor
              .chain()
              .focus()
              .toggleList("taskList", "taskItem")
              .run(),
          active: () => editor.isActive("taskList"),
        }),
      ),
    );
    const paragraph = menu(t("문단 모양"), "paragraph");
    const layout = paragraph.panel;
    for (const [category, label] of [
      ["alignment", "정렬"],
      ["spacing", "줄 간격"],
      ["textSize", "문단 크기"],
    ] as const) {
      const select = createTokenSelect(editor, category, label, locale);
      controls.push(select);
      layout.append(menuField(t(label), select));
    }
    add(
      layout,
      labelMenuAction(
        createButton({
          label: t("내어쓰기"),
          run: () => void changeIndentation(editor, -1),
          enabled: () => canChangeIndentation(editor, -1),
        }),
      ),
    );
    add(
      layout,
      labelMenuAction(
        createButton({
          label: t("들여쓰기"),
          run: () => void changeIndentation(editor, 1),
          enabled: () => canChangeIndentation(editor, 1),
        }),
      ),
    );
    add(
      layout,
      labelMenuAction(
        createButton({
          label: t("인용"),
          run: () => void editor.chain().focus().toggleBlockquote().run(),
          active: () => editor.isActive("blockquote"),
        }),
      ),
    );
  }

  const insert = addGroup(t("삽입"));
  const link = createButton({
    label: t("링크"),
    run: () => undefined,
    active: () => editor.isActive("link"),
  });
  add(insert, link);
  dialogs.push(createLinkDialog(editor, link, locale));

  const image = createButton({ label: t("이미지"), run: () => undefined });
  add(insert, image);
  dialogs.push(
    createImageDialog(
      editor,
      image,
      options.imageUpload,
      options.imageMaxSizeMb,
      locale,
    ),
  );

  if (profile !== "minimal") {
    const table = createButton({ label: t("표"), run: () => undefined });
    add(insert, table);
    const media = options.mediaEmbed
      ? createButton({ label: t("동영상"), run: () => undefined })
      : null;
    if (media) add(insert, media);
    dialogs.push(createTableDialog(editor, table, locale));
    if (media) {
      dialogs.push(
        createMediaDialog(
          editor,
          media,
          options.mediaOptions,
          options.videoUpload,
          options.videoMaxSizeMb,
          locale,
        ),
      );
    }
    if (options.smartCards) {
      const smartCard = createButton({
        label: t("링크 카드"),
        run: () => undefined,
      });
      add(insert, smartCard);
      dialogs.push(createSmartCardDialog(editor, smartCard, locale));
    }
    add(
      insert,
      createButton({
        label: t("구분선"),
        run: () => void editor.chain().focus().setHorizontalRule().run(),
      }),
    );
  }

  const history = addGroup(t("기록"));
  add(
    history,
    createButton({
      label: t("실행취소"),
      title: t("실행취소 (Ctrl/Command+Z)"),
      run: () => void editor.chain().focus().undo().run(),
      enabled: () => editor.can().undo(),
    }),
  );

  toolbar.prepend(history);
  if (profile !== "minimal") {
    const more = menu(locale === "en" ? "More tools" : "도구 더보기", "more");
    const formatting = installWritingTools(
      editor,
      region,
      toolbar,
      more.panel,
      locale,
    );
    inline.after(formatting.trigger);
  }
  const insertMenu = menu(
    locale === "en" ? "Insert tools" : "삽입 도구",
    "insert",
  );
  const stopResponsive = installResponsiveInsert(toolbar, insert, insertMenu);
  add(
    history,
    createButton({
      label: t("다시실행"),
      title: t("다시실행 (Ctrl/Command+Shift+Z)"),
      run: () => void editor.chain().focus().redo().run(),
      enabled: () => editor.can().redo(),
    }),
  );

  for (const dialog of dialogs) region.appendChild(dialog.element);
  for (const dialog of dialogs) {
    dialog.trigger.addEventListener("click", () => {
      for (const candidate of dialogs) {
        if (candidate !== dialog) candidate.close(false);
      }
    });
  }

  const update = () => {
    for (const control of controls) control.__jwsoftUpdate?.(editor.isEditable);
    for (const handle of menus) handle.trigger.disabled = !editor.isEditable;
    toolbar.dispatchEvent(new Event("jwsoft-controls-updated"));
  };
  editor.on("transaction", update);
  editor.on("selectionUpdate", update);
  editor.on("update", update);
  editor.on("destroy", () => {
    editor.off("transaction", update);
    editor.off("selectionUpdate", update);
    editor.off("update", update);
  });
  installRovingKeyboard(toolbar);
  editor.on("destroy", () => {
    stopResponsive();
    for (const handle of menus) handle.destroy();
  });
  update();
  return region;
}
