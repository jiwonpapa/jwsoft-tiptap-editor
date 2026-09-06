import type { Editor } from "@tiptap/core";
import { createDialog } from "@/editor/dialog";
import { formField } from "@/editor/dialogFields";
import { editorIcon } from "@/editor/icons";
import { labelMenuAction } from "@/editor/menuControls";
import { insertPlainText } from "@/editor/plainTextPaste";

export function installPlainTextDialog(
  editor: Editor,
  region: HTMLElement,
  menu: HTMLElement,
  locale: string,
): void {
  const en = locale === "en";
  const name = en ? "Paste as text" : "텍스트만 붙여넣기";
  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "jwsoft-tiptap-tool";
  trigger.setAttribute("aria-label", name);
  trigger.append(editorIcon("paste"));
  menu.append(labelMenuAction(trigger));
  const form = document.createElement("form");
  form.className = "jwsoft-tiptap-dialog-form";
  const input = document.createElement("textarea");
  input.rows = 8;
  const hint = document.createElement("p");
  hint.textContent = en
    ? "Paste here, then insert. Formatting and automatic embeds are not applied."
    : "여기에 붙여넣고 삽입하세요. 서식과 자동 미디어 변환은 적용하지 않습니다.";
  const apply = document.createElement("button");
  apply.type = "submit";
  apply.className = "jwsoft-tiptap-dialog-primary";
  apply.textContent = en ? "Insert text" : "텍스트 삽입";
  form.append(hint, formField(name, input), apply);
  const dialog = createDialog({
    editor,
    trigger,
    content: form,
    title: name,
    locale,
  });
  region.append(dialog.element);
  trigger.addEventListener("click", () => {
    input.value = "";
    input.focus();
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (insertPlainText(editor.view, input.value)) dialog.close();
  });
  dialog.onClose(() => {
    input.value = "";
  });
  const update = () => {
    trigger.disabled = !editor.isEditable;
  };
  editor.on("transaction", update);
  editor.on("destroy", () => editor.off("transaction", update));
  update();
}
