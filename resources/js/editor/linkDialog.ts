import type { Editor } from "@tiptap/core";
import { createDialog, type DialogHandle } from "@/editor/dialog";
import { formField, formError } from "@/editor/dialogFields";
import { applyEditorLink } from "@/editor/linkCommand";
import { editorText } from "@/editor/locale";

function linkFields(locale: string) {
  const form = document.createElement("form");
  form.className = "jwsoft-tiptap-dialog-form";
  const href = document.createElement("input");
  href.type = "text";
  href.inputMode = "url";
  href.placeholder = "https://example.com";
  const text = document.createElement("input");
  text.type = "text";
  text.placeholder = editorText(
    locale,
    "비우면 선택한 글자 또는 주소를 사용합니다.",
  );
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
    formField(editorText(locale, "표시할 텍스트 (선택 사항)"), text),
    formField(editorText(locale, "설명"), title),
    blankLabel,
    error,
    actions,
  );
  return { form, href, text, title, blank, error, remove };
}

export function createLinkDialog(
  editor: Editor,
  trigger: HTMLButtonElement,
  locale: string,
): DialogHandle {
  const fields = linkFields(locale);
  const { form, href, text, title, blank, error, remove } = fields;
  trigger.addEventListener("click", () => {
    const attributes = editor.getAttributes("link");
    href.value = typeof attributes.href === "string" ? attributes.href : "";
    title.value = typeof attributes.title === "string" ? attributes.title : "";
    text.value = "";
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
    if (
      !applyEditorLink(editor, {
        href: href.value,
        text: text.value,
        title: title.value,
        newWindow: blank.checked,
      })
    ) {
      error.textContent = editorText(
        locale,
        "https, mailto, tel 또는 상대 경로만 사용할 수 있습니다.",
      );
      error.hidden = false;
      href.focus();
      return;
    }
    handle.close();
  });
  remove.addEventListener("click", () => {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    handle.close();
  });
  return handle;
}
