import type { Editor } from "@tiptap/core";
import { NodeSelection } from "@tiptap/pm/state";
import {
  activeClassToken,
  type ClassTokenCategory,
} from "@/editor/classTokens";
import { editorIcon, type EditorIcon } from "@/editor/icons";
import type { InlineCategory } from "@/editor/inlineStyle";
import { createPopover } from "@/editor/popover";
import { createFindReplace } from "@/editor/findReplace";
import { EDITOR_POLICY } from "@/generated/editorPolicy";

export function installWritingTools(
  editor: Editor,
  region: HTMLElement,
  toolbar: HTMLElement,
  more: HTMLElement,
  locale: string,
) {
  const en = locale === "en";
  const button = (label: string, icon: EditorIcon, run: () => void) => {
    const element = document.createElement("button");
    element.type = "button";
    element.className = "jwsoft-tiptap-tool";
    element.title = label;
    element.setAttribute("aria-label", label);
    element.dataset.tooltip = label;
    element.append(editorIcon(icon));
    element.addEventListener("mousedown", (event) => event.preventDefault());
    element.addEventListener("click", run);
    return element;
  };
  const formatting = createPopover(
    en ? "Text appearance" : "글자 모양",
    "text",
  );
  const panel = formatting.panel;
  const inlineLabels: Record<InlineCategory, string> = {
    inlineSize: en ? "Font size" : "글자 크기",
    textColor: en ? "Text color" : "글자색",
    highlight: en ? "Highlight" : "강조색",
  };
  const labels: Record<string, string> = en
    ? {
        gray: "Gray",
        red: "Red",
        orange: "Orange",
        green: "Green",
        blue: "Blue",
        purple: "Purple",
        yellow: "Yellow",
        pink: "Pink",
      }
    : {
        gray: "회색",
        red: "빨강",
        orange: "주황",
        green: "초록",
        blue: "파랑",
        purple: "보라",
        yellow: "노랑",
        pink: "분홍",
      };
  const size = document.createElement("select");
  size.className = "jwsoft-tiptap-select";
  size.setAttribute("aria-label", inlineLabels.inlineSize);
  size.add(new Option(en ? "Default" : "기본", ""));
  for (const token of EDITOR_POLICY.classTokens.inlineSize)
    size.add(new Option(`${token.split("-").slice(-1)[0]} px`, token));
  size.addEventListener("change", () =>
    editor
      .chain()
      .focus()
      .setMark("jwTextStyle", { inlineSize: size.value || null })
      .run(),
  );
  const sizeLabel = document.createElement("label");
  sizeLabel.className = "jwsoft-format-row";
  sizeLabel.append(document.createTextNode(inlineLabels.inlineSize), size);
  panel.append(sizeLabel);
  const colorButtons: Array<{
    element: HTMLButtonElement;
    category: InlineCategory;
    token: string | null;
  }> = [];
  for (const category of ["textColor", "highlight"] as const) {
    const label = document.createElement("p");
    label.className = "jwsoft-menu-label";
    label.textContent = inlineLabels[category];
    panel.append(label);
    const grid = document.createElement("div");
    grid.className = "jwsoft-color-grid";
    for (const token of [null, ...EDITOR_POLICY.classTokens[category]]) {
      const name = token
        ? labels[token.split("-").slice(-1)[0]]
        : en
          ? "Default"
          : "기본";
      const control = button(
        `${inlineLabels[category]}: ${name}`,
        category === "textColor" ? "text" : "highlight",
        () => {
          editor
            .chain()
            .focus()
            .setMark("jwTextStyle", { [category]: token })
            .run();
          formatting.close();
        },
      );
      if (token) control.classList.add(token);
      grid.append(control);
      colorButtons.push({ element: control, category, token });
    }
    panel.append(grid);
  }
  toolbar.insertBefore(formatting.trigger, toolbar.lastElementChild);
  region.append(panel);
  const advanced = document.createElement("div");
  advanced.className = "jwsoft-tiptap-tool-group";
  advanced.append(
    button(en ? "Subscript" : "아래 첨자", "subscript", () =>
      editor.chain().focus().toggleMark("subscript").run(),
    ),
    button(en ? "Superscript" : "위 첨자", "superscript", () =>
      editor.chain().focus().toggleMark("superscript").run(),
    ),
    button(en ? "Checklist" : "체크리스트", "taskList", () =>
      editor.chain().focus().toggleList("taskList", "taskItem").run(),
    ),
    button(en ? "Clear formatting" : "서식 지우기", "remove", () => {
      const chain = editor.chain().focus().unsetAllMarks().clearNodes();
      for (const category of [
        "textSize",
        "alignment",
        "spacing",
        "indentation",
      ] as const)
        chain.setClassToken(category, null);
      chain.run();
    }),
  );
  more.prepend(advanced);
  const search = button(
    en ? "Find and replace" : "찾기 / 바꾸기",
    "search",
    () => {},
  );
  advanced.append(search);
  const findDialog = createFindReplace(editor, search, locale);
  region.append(findDialog.element);
  let fullscreen = false,
    previousOverflow = "";
  const shell = () => region.closest<HTMLElement>(".jwsoft-tiptap-shell");
  const toggleFullscreen = () => {
    fullscreen = !fullscreen;
    shell()?.classList.toggle("jwsoft-editor-fullscreen", fullscreen);
    if (fullscreen) {
      previousOverflow = document.documentElement.style.overflow;
      document.documentElement.style.overflow = "hidden";
    } else document.documentElement.style.overflow = previousOverflow;
    full.replaceChildren(
      editorIcon(fullscreen ? "exitFullscreen" : "fullscreen"),
    );
    full.setAttribute("aria-pressed", String(fullscreen));
  };
  const full = button(
    en ? "Fullscreen" : "전체화면",
    "fullscreen",
    toggleFullscreen,
  );
  advanced.append(full);
  const escapeFullscreen = (event: KeyboardEvent) => {
    if (
      event.key === "Escape" &&
      fullscreen &&
      !document.querySelector("dialog[open], [popover]:popover-open")
    )
      toggleFullscreen();
  };
  document.addEventListener("keydown", escapeFullscreen);

  const context = document.createElement("div");
  context.className = "jwsoft-context-tools";
  context.popover = "manual";
  context.setAttribute("role", "toolbar");
  region.append(context);
  let contextKind = "";
  const contextButtons: Array<{
    button: HTMLButtonElement;
    can: () => boolean;
  }> = [];
  const add = (
    label: string,
    icon: EditorIcon,
    run: () => void,
    can: () => boolean = () => true,
  ) => {
    const control = button(label, icon, run);
    context.append(control);
    contextButtons.push({ button: control, can });
  };
  const openMain = (label: string) => {
    [...toolbar.querySelectorAll<HTMLButtonElement>("button")]
      .find((control) => control.getAttribute("aria-label") === label)
      ?.click();
  };
  const selectToken = (
    category: ClassTokenCategory,
    label: string,
    tokenLabels: string[],
  ) => {
    const select = document.createElement("select");
    select.className = "jwsoft-tiptap-select";
    select.setAttribute("aria-label", label);
    select.dataset.category = category;
    select.add(new Option(label, ""));
    EDITOR_POLICY.classTokens[category].forEach((token, index) =>
      select.add(new Option(tokenLabels[index] ?? token, token)),
    );
    select.value = activeClassToken(editor, category) ?? "";
    select.addEventListener("change", () =>
      editor
        .chain()
        .focus()
        .setClassToken(category, select.value || null)
        .run(),
    );
    context.append(select);
  };
  const rebuildContext = (kind: string) => {
    context.replaceChildren();
    contextButtons.length = 0;
    contextKind = kind;
    context.setAttribute(
      "aria-label",
      en
        ? `${kind} tools`
        : `${kind === "image" ? "이미지" : kind === "table" ? "표" : "선택 영역"} 편집 도구`,
    );
    if (kind === "image") {
      for (const [alignment, icon, label] of [
        ["left", "alignLeft", "왼쪽"],
        ["center", "alignCenter", "가운데"],
        ["right", "alignRight", "오른쪽"],
      ] as const) {
        add(en ? `Align ${alignment}` : `이미지 ${label} 정렬`, icon, () => {
          const tokens = String(
            editor.getAttributes("image").jwClassTokens ?? "",
          )
            .split(/\s+/)
            .filter((token) => !token.startsWith("jw-image-align-"));
          tokens.push(`jw-image-align-${alignment}`);
          editor
            .chain()
            .focus()
            .updateAttributes("image", {
              jwClassTokens: tokens.sort().join(" "),
            })
            .run();
        });
      }
      add(en ? "Image settings" : "이미지 설정", "image", () =>
        openMain(en ? "Image" : "이미지"),
      );
      add(en ? "Remove image" : "이미지 삭제", "remove", () =>
        editor.chain().focus().deleteSelection().run(),
      );
    } else if (kind === "table") {
      add(en ? "Add row" : "행 추가", "rows", () =>
        editor.chain().focus().addRowAfter().run(),
      );
      add(en ? "Delete row" : "행 삭제", "remove", () =>
        editor.chain().focus().deleteRow().run(),
      );
      add(en ? "Add column" : "열 추가", "columns", () =>
        editor.chain().focus().addColumnAfter().run(),
      );
      add(en ? "Delete column" : "열 삭제", "remove", () =>
        editor.chain().focus().deleteColumn().run(),
      );
      add(
        en ? "Merge cells" : "셀 병합",
        "merge",
        () => editor.chain().focus().mergeCells().run(),
        () => editor.can().mergeCells(),
      );
      add(
        en ? "Split cell" : "셀 분할",
        "split",
        () => editor.chain().focus().splitCell().run(),
        () => editor.can().splitCell(),
      );
      add(en ? "Toggle header row" : "머리글 행 전환", "table", () =>
        editor.chain().focus().toggleHeaderRow().run(),
      );
      add(en ? "Delete table" : "표 삭제", "remove", () =>
        editor.chain().focus().deleteTable().run(),
      );
      selectToken(
        "cellBackground",
        en ? "Cell background" : "셀 배경",
        en
          ? ["Gray", "Blue", "Green", "Yellow", "Pink"]
          : ["회색", "파랑", "초록", "노랑", "분홍"],
      );
      selectToken(
        "cellVertical",
        en ? "Vertical alignment" : "세로 정렬",
        en ? ["Top", "Middle", "Bottom"] : ["위", "가운데", "아래"],
      );
      selectToken(
        "tableBorder",
        en ? "Table border" : "표 테두리",
        en ? ["Bordered", "Borderless"] : ["테두리 있음", "테두리 없음"],
      );
    } else {
      add(en ? "Selection: bold" : "선택 영역: 굵게", "bold", () =>
        editor.chain().focus().toggleBold().run(),
      );
      add(en ? "Selection: italic" : "선택 영역: 기울임", "italic", () =>
        editor.chain().focus().toggleItalic().run(),
      );
      add(en ? "Selection: underline" : "선택 영역: 밑줄", "underline", () =>
        editor.chain().focus().toggleUnderline().run(),
      );
      add(en ? "Selection: link" : "선택 영역: 링크", "link", () =>
        openMain(en ? "Link" : "링크"),
      );
    }
  };
  const count = document.createElement("div");
  count.className = "jwsoft-editor-footer";
  region.parentElement?.append(count);
  // Region is inserted by the G7 adapter after this function returns.
  queueMicrotask(() => {
    if (!editor.isDestroyed && !count.isConnected)
      region.parentElement?.append(count);
  });
  const update = () => {
    const attributes = editor.getAttributes("jwTextStyle");
    size.value = attributes.inlineSize ?? "";
    for (const item of colorButtons)
      item.element.setAttribute(
        "aria-pressed",
        String((attributes[item.category] ?? null) === item.token),
      );
    const length = Array.from(editor.state.doc.textContent).length;
    count.textContent = en
      ? `${length.toLocaleString()} characters`
      : `${length.toLocaleString()}자`;
    for (const control of [
      ...advanced.querySelectorAll("button"),
      formatting.trigger,
    ])
      control.disabled = !editor.isEditable;
    if (typeof context.showPopover !== "function") return;
    if (
      !editor.isEditable ||
      document.querySelector("dialog[open]") ||
      region.querySelector(".jwsoft-tiptap-popover:popover-open") ||
      !editor.view.dom.isConnected
    ) {
      if (context.matches(":popover-open")) context.hidePopover();
      return;
    }
    const { selection } = editor.state;
    const kind =
      selection instanceof NodeSelection && selection.node.type.name === "image"
        ? "image"
        : editor.isActive("table")
          ? "table"
          : !selection.empty && !(selection instanceof NodeSelection)
            ? "text"
            : "";
    if (!kind) {
      if (context.matches(":popover-open")) context.hidePopover();
      return;
    }
    if (contextKind !== kind) rebuildContext(kind);
    for (const item of contextButtons) item.button.disabled = !item.can();
    for (const select of context.querySelectorAll<HTMLSelectElement>(
      "select[data-category]",
    ))
      select.value =
        activeClassToken(
          editor,
          select.dataset.category as ClassTokenCategory,
        ) ?? "";
    if (!context.matches(":popover-open")) context.showPopover();
    const rect = editor.view.coordsAtPos(selection.from);
    const endRect = editor.view.coordsAtPos(selection.to);
    const width = window.visualViewport?.width ?? window.innerWidth;
    const height = window.visualViewport?.height ?? window.innerHeight;
    const minimumTop = Math.max(8, toolbar.getBoundingClientRect().bottom + 6);
    const above = rect.top - context.offsetHeight - 10;
    context.style.left = `${Math.max(8, Math.min(rect.left, width - context.offsetWidth - 8))}px`;
    context.style.top = `${Math.max(8, Math.min(above >= minimumTop ? above : endRect.bottom + 8, height - context.offsetHeight - 8))}px`;
  };
  const safeUpdate = () => {
    if (!editor.isDestroyed) update();
  };
  editor.on("selectionUpdate", safeUpdate);
  editor.on("update", safeUpdate);
  window.addEventListener("resize", safeUpdate);
  window.addEventListener("scroll", safeUpdate, true);
  window.visualViewport?.addEventListener("resize", safeUpdate);
  document.addEventListener("click", safeUpdate);
  editor.on("destroy", () => {
    formatting.destroy();
    context.remove();
    count.remove();
    document.removeEventListener("keydown", escapeFullscreen);
    window.removeEventListener("resize", safeUpdate);
    window.removeEventListener("scroll", safeUpdate, true);
    window.visualViewport?.removeEventListener("resize", safeUpdate);
    document.removeEventListener("click", safeUpdate);
    if (fullscreen) document.documentElement.style.overflow = previousOverflow;
  });
  // No form/style state is ever serialized; only policy mark attributes are.
  queueMicrotask(() => {
    if (!editor.isDestroyed) update();
  });
}
