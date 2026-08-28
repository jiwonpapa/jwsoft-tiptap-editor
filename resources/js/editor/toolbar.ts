import type { Editor } from "@tiptap/core";

import {
  activeClassToken,
  type ClassTokenCategory,
} from "@/editor/classTokens";
import { EDITOR_POLICY } from "@/generated/editorPolicy";
import { isAllowedEditorUrl } from "@/policy/runtimePolicy";

export const TOOLBAR_PROFILES = ["minimal", "standard", "full"] as const;
export type ToolbarProfile = (typeof TOOLBAR_PROFILES)[number];

interface ToolbarOptions {
  editor: Editor;
  profile: ToolbarProfile;
}

interface ButtonOptions {
  label: string;
  title?: string;
  run: () => void;
  active?: () => boolean;
  enabled?: () => boolean;
}

interface DialogHandle {
  element: HTMLElement;
  trigger: HTMLButtonElement;
  close: (restoreFocus?: boolean) => void;
}

const tokenLabels: Record<ClassTokenCategory, Record<string, string>> = {
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
    "jw-image-inline": "글 안",
    "jw-image-block": "가운데 블록",
    "jw-image-rounded": "둥근 모서리",
  },
};
let dialogSequence = 0;

export function normalizeToolbarProfile(value: unknown): ToolbarProfile {
  return TOOLBAR_PROFILES.includes(value as ToolbarProfile)
    ? (value as ToolbarProfile)
    : "standard";
}

function createButton(options: ButtonOptions): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "jwsoft-tiptap-tool";
  button.textContent = options.label;
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

function createBlockSelect(editor: Editor): HTMLSelectElement {
  const select = document.createElement("select");
  select.className = "jwsoft-tiptap-select";
  select.setAttribute("aria-label", "문단 종류");
  const blocks = [
    ["paragraph", "본문"],
    ["heading-2", "제목 2"],
    ["heading-3", "제목 3"],
    ["heading-4", "제목 4"],
    ["codeBlock", "코드 블록"],
  ] as const;
  for (const [value, label] of blocks) {
    select.add(new Option(label, value));
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
): HTMLSelectElement {
  const select = document.createElement("select");
  select.className = "jwsoft-tiptap-select";
  select.setAttribute("aria-label", label);
  select.add(new Option(label, ""));
  for (const token of EDITOR_POLICY.classTokens[category]) {
    select.add(new Option(tokenLabels[category][token] ?? token, token));
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

function createDialog(options: {
  title: string;
  trigger: HTMLButtonElement;
  content: HTMLElement;
}): DialogHandle {
  const dialog = document.createElement("section");
  dialogSequence += 1;
  const headingId = `jwsoft-dialog-${dialogSequence}`;
  dialog.className = "jwsoft-tiptap-dialog";
  dialog.hidden = true;
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "false");
  dialog.setAttribute("aria-labelledby", headingId);

  const header = document.createElement("header");
  header.className = "jwsoft-tiptap-dialog-header";
  const heading = document.createElement("strong");
  heading.id = headingId;
  heading.textContent = options.title;
  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "jwsoft-tiptap-dialog-close";
  closeButton.setAttribute("aria-label", "닫기");
  closeButton.textContent = "닫기";
  header.append(heading, closeButton);
  dialog.append(header, options.content);

  const close = (restoreFocus = true) => {
    dialog.hidden = true;
    options.trigger.setAttribute("aria-expanded", "false");
    if (restoreFocus) options.trigger.focus();
  };
  const open = () => {
    dialog.hidden = false;
    options.trigger.setAttribute("aria-expanded", "true");
    dialog.querySelector<HTMLElement>("input, button, select")?.focus();
  };
  closeButton.addEventListener("click", () => close());
  dialog.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    close();
  });
  options.trigger.setAttribute("aria-haspopup", "dialog");
  options.trigger.setAttribute("aria-expanded", "false");
  options.trigger.addEventListener("click", open);
  return { element: dialog, trigger: options.trigger, close };
}

function formField(labelText: string, input: HTMLInputElement): HTMLElement {
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
): DialogHandle {
  const form = document.createElement("form");
  form.className = "jwsoft-tiptap-dialog-form";
  const href = document.createElement("input");
  href.type = "text";
  href.inputMode = "url";
  href.placeholder = "https://example.com 또는 /경로";
  const title = document.createElement("input");
  title.type = "text";
  const blank = document.createElement("input");
  blank.type = "checkbox";
  const blankLabel = formField("새 창에서 열기", blank);
  blankLabel.classList.add("jwsoft-tiptap-field-inline");
  const error = formError();
  const actions = document.createElement("div");
  actions.className = "jwsoft-tiptap-dialog-actions";
  const apply = document.createElement("button");
  apply.type = "submit";
  apply.className = "jwsoft-tiptap-dialog-primary";
  apply.textContent = "링크 적용";
  const remove = document.createElement("button");
  remove.type = "button";
  remove.textContent = "링크 해제";
  actions.append(apply, remove);
  form.append(
    formField("주소", href),
    formField("설명", title),
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
  const handle = createDialog({ title: "링크", trigger, content: form });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const value = href.value.trim();
    if (!isAllowedEditorUrl(value)) {
      error.textContent =
        "https, mailto, tel 또는 상대 경로만 사용할 수 있습니다.";
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
  apply.textContent = "표 삽입";
  form.append(formField("행", rows), formField("열", columns), error, apply);
  const handle = createDialog({ title: "표 만들기", trigger, content: form });
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
      error.textContent = "행과 열은 각각 1~20 사이여야 합니다.";
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
): DialogHandle {
  const form = document.createElement("form");
  form.className = "jwsoft-tiptap-dialog-form";
  const src = document.createElement("input");
  src.type = "text";
  src.inputMode = "url";
  src.placeholder = "https://example.com/image.webp 또는 /경로";
  const alt = document.createElement("input");
  alt.type = "text";
  const title = document.createElement("input");
  title.type = "text";
  const error = formError();
  const apply = document.createElement("button");
  apply.type = "submit";
  apply.className = "jwsoft-tiptap-dialog-primary";
  apply.textContent = "이미지 삽입";
  form.append(
    formField("이미지 주소", src),
    formField("대체 텍스트", alt),
    formField("설명", title),
    error,
    apply,
  );
  const handle = createDialog({
    title: "이미지 URL",
    trigger,
    content: form,
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const value = src.value.trim();
    if (!isAllowedEditorUrl(value, true)) {
      error.textContent = "https 또는 상대 경로 이미지만 사용할 수 있습니다.";
      error.hidden = false;
      src.focus();
      return;
    }
    editor
      .chain()
      .focus()
      .insertContent({
        type: "image",
        attrs: {
          src: value,
          alt: alt.value.trim(),
          title: title.value.trim() || null,
          jwClassTokens: "jw-image-block",
        },
      })
      .run();
    handle.close();
  });
  return handle;
}

function installRovingKeyboard(toolbar: HTMLElement): void {
  toolbar.addEventListener("keydown", (event) => {
    if (!(event.target instanceof HTMLButtonElement)) return;
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
      return;
    }
    const controls = [
      ...toolbar.querySelectorAll<HTMLElement>(
        "button:not(:disabled), select:not(:disabled)",
      ),
    ];
    const current = controls.indexOf(event.target);
    if (current < 0 || controls.length === 0) return;
    event.preventDefault();
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? controls.length - 1
          : event.key === "ArrowRight"
            ? (current + 1) % controls.length
            : (current - 1 + controls.length) % controls.length;
    controls[next].focus();
  });
}

export function createEditorToolbar(options: ToolbarOptions): HTMLElement {
  const { editor, profile } = options;
  const region = document.createElement("div");
  region.className = "jwsoft-tiptap-toolbar-region";
  const toolbar = document.createElement("div");
  toolbar.className = "jwsoft-tiptap-toolbar";
  toolbar.setAttribute("role", "toolbar");
  toolbar.setAttribute("aria-label", `${profile} 편집 도구`);
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

  const block = addGroup("문단");
  add(block, createBlockSelect(editor));

  const inline = addGroup("글자 서식");
  add(
    inline,
    createButton({
      label: "굵게",
      title: "굵게 (Ctrl/Command+B)",
      run: () => void editor.chain().focus().toggleBold().run(),
      active: () => editor.isActive("bold"),
    }),
  );
  add(
    inline,
    createButton({
      label: "기울임",
      title: "기울임 (Ctrl/Command+I)",
      run: () => void editor.chain().focus().toggleItalic().run(),
      active: () => editor.isActive("italic"),
    }),
  );
  if (profile !== "minimal") {
    add(
      inline,
      createButton({
        label: "밑줄",
        title: "밑줄 (Ctrl/Command+U)",
        run: () => void editor.chain().focus().toggleUnderline().run(),
        active: () => editor.isActive("underline"),
      }),
    );
    add(
      inline,
      createButton({
        label: "취소선",
        run: () => void editor.chain().focus().toggleStrike().run(),
        active: () => editor.isActive("strike"),
      }),
    );
    add(
      inline,
      createButton({
        label: "코드",
        run: () => void editor.chain().focus().toggleCode().run(),
        active: () => editor.isActive("code"),
      }),
    );
  }

  if (profile !== "minimal") {
    const structure = addGroup("구조");
    add(
      structure,
      createButton({
        label: "인용",
        run: () => void editor.chain().focus().toggleBlockquote().run(),
        active: () => editor.isActive("blockquote"),
      }),
    );
    add(
      structure,
      createButton({
        label: "목록",
        title: "글머리 목록",
        run: () => void editor.chain().focus().toggleBulletList().run(),
        active: () => editor.isActive("bulletList"),
      }),
    );
    add(
      structure,
      createButton({
        label: "번호",
        title: "번호 목록",
        run: () => void editor.chain().focus().toggleOrderedList().run(),
        active: () => editor.isActive("orderedList"),
      }),
    );
    add(
      structure,
      createButton({
        label: "구분선",
        run: () => void editor.chain().focus().setHorizontalRule().run(),
      }),
    );

    const layout = addGroup("문단 모양");
    add(layout, createTokenSelect(editor, "textSize", "문단 크기"));
    add(layout, createTokenSelect(editor, "alignment", "정렬"));
    add(layout, createTokenSelect(editor, "spacing", "줄 간격"));
  }

  const insert = addGroup("삽입");
  const link = createButton({
    label: "링크",
    run: () => undefined,
    active: () => editor.isActive("link"),
  });
  add(insert, link);
  dialogs.push(createLinkDialog(editor, link));

  if (profile !== "minimal") {
    const table = createButton({ label: "표", run: () => undefined });
    const image = createButton({
      label: "이미지 URL",
      run: () => undefined,
    });
    add(insert, table);
    add(insert, image);
    dialogs.push(
      createTableDialog(editor, table),
      createImageDialog(editor, image),
    );
  }

  if (profile === "full") {
    const tableTools = addGroup("표 편집");
    for (const item of [
      [
        "행+",
        () => editor.chain().focus().addRowAfter().run(),
        () => editor.can().addRowAfter(),
      ],
      [
        "행−",
        () => editor.chain().focus().deleteRow().run(),
        () => editor.can().deleteRow(),
      ],
      [
        "열+",
        () => editor.chain().focus().addColumnAfter().run(),
        () => editor.can().addColumnAfter(),
      ],
      [
        "열−",
        () => editor.chain().focus().deleteColumn().run(),
        () => editor.can().deleteColumn(),
      ],
      [
        "표 삭제",
        () => editor.chain().focus().deleteTable().run(),
        () => editor.can().deleteTable(),
      ],
    ] as const) {
      add(
        tableTools,
        createButton({
          label: item[0],
          run: () => void item[1](),
          enabled: item[2],
        }),
      );
    }
  }

  const history = addGroup("기록");
  add(
    history,
    createButton({
      label: "실행취소",
      title: "실행취소 (Ctrl/Command+Z)",
      run: () => void editor.chain().focus().undo().run(),
      enabled: () => editor.can().undo(),
    }),
  );
  add(
    history,
    createButton({
      label: "다시실행",
      title: "다시실행 (Ctrl/Command+Shift+Z)",
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
  update();
  return region;
}
