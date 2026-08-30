import type { Editor } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { createDialog } from "@/editor/dialog";

export function findTextMatches(
  doc: ProseMirrorNode,
  query: string,
  caseSensitive = false,
): Array<{ from: number; to: number }> {
  if (!query || query.length > 256) return [];
  const pattern = new RegExp(
    query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    caseSensitive ? "gu" : "giu",
  );
  const matches: Array<{ from: number; to: number }> = [];
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return;
    let text = "";
    node.forEach((child) => {
      text += child.isText ? child.text : "\ufffc".repeat(child.nodeSize);
    });
    for (const match of text.matchAll(pattern)) {
      matches.push({
        from: pos + 1 + match.index!,
        to: pos + 1 + match.index! + match[0].length,
      });
    }
    return false;
  });
  return matches;
}

export function createFindReplace(
  editor: Editor,
  trigger: HTMLButtonElement,
  locale: string,
) {
  const en = locale === "en";
  const form = document.createElement("form");
  form.className = "jwsoft-tiptap-dialog-form";
  const query = document.createElement("input");
  query.type = "search";
  query.maxLength = 256;
  const replacement = document.createElement("input");
  replacement.type = "text";
  const field = (label: string, input: HTMLInputElement) => {
    const row = document.createElement("label");
    row.className = "jwsoft-tiptap-field";
    const text = document.createElement("span");
    text.textContent = label;
    row.append(text, input);
    return row;
  };
  const sensitive = document.createElement("input");
  sensitive.type = "checkbox";
  const sensitiveField = field(en ? "Match case" : "대소문자 구분", sensitive);
  sensitiveField.classList.add("jwsoft-tiptap-field-inline");
  const status = document.createElement("p");
  status.className = "jwsoft-search-status";
  status.setAttribute("role", "status");
  const actions = document.createElement("div");
  actions.className = "jwsoft-tiptap-dialog-actions";
  let index = -1;
  const matches = () =>
    findTextMatches(editor.state.doc, query.value, sensitive.checked);
  const refresh = () => {
    const list = matches();
    status.textContent = query.value
      ? en
        ? `${list.length} matches`
        : `${list.length}개 일치`
      : en
        ? "Enter text to find."
        : "찾을 내용을 입력하세요.";
    for (const button of actions.querySelectorAll("button"))
      button.disabled = !list.length;
    return list;
  };
  const navigate = (delta: number) => {
    const list = refresh();
    if (!list.length) return;
    index = (index + delta + list.length) % list.length;
    editor.commands.setTextSelection(list[index]);
    editor.commands.scrollIntoView();
    status.textContent = `${index + 1} / ${list.length}`;
  };
  const action = (label: string, run: () => void) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.addEventListener("click", run);
    actions.append(button);
  };
  action(en ? "Previous" : "이전", () => navigate(-1));
  action(en ? "Next" : "다음", () => navigate(1));
  action(en ? "Replace" : "바꾸기", () => {
    const list = matches();
    if (!list.length) return;
    const target = list[Math.max(0, Math.min(index, list.length - 1))];
    editor.view.dispatch(
      editor.state.tr.insertText(replacement.value, target.from, target.to),
    );
    index = -1;
    refresh();
  });
  action(en ? "Replace all" : "모두 바꾸기", () => {
    const list = matches();
    if (!list.length) return;
    const transaction = editor.state.tr;
    for (const target of list.reverse())
      transaction.insertText(replacement.value, target.from, target.to);
    editor.view.dispatch(transaction);
    index = -1;
    refresh();
  });
  query.addEventListener("input", () => {
    index = -1;
    refresh();
  });
  sensitive.addEventListener("change", () => {
    index = -1;
    refresh();
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    event.stopPropagation();
    navigate(1);
  });
  form.append(
    field(en ? "Find" : "찾을 내용", query),
    field(en ? "Replace with" : "바꿀 내용", replacement),
    sensitiveField,
    status,
    actions,
  );
  const dialog = createDialog({
    editor,
    trigger,
    title: en ? "Find and replace" : "찾기 / 바꾸기",
    content: form,
    locale,
    compact: true,
  });
  trigger.addEventListener("click", () => {
    index = -1;
    refresh();
  });
  return dialog;
}
