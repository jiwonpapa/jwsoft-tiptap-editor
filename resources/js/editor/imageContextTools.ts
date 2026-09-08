import type { Editor } from "@tiptap/core";
import type { EditorIcon } from "@/editor/icons";

type AddContextTool = (
  label: string,
  icon: EditorIcon,
  run: () => void,
  can?: () => boolean,
) => HTMLButtonElement;

export function installImageContextTools(
  editor: Editor,
  en: boolean,
  imageEditorControl: HTMLButtonElement | null,
  add: AddContextTool,
  openImageSettings: () => void,
): void {
  if (imageEditorControl) {
    const edit = add(
      en ? "Edit image" : "이미지 편집",
      "editImage",
      () => imageEditorControl.click(),
      () => !imageEditorControl.disabled,
    );
    edit.append(en ? " Edit" : " 편집");
  }
  for (const [alignment, icon, label] of [
    ["left", "alignLeft", "왼쪽"],
    ["center", "alignCenter", "가운데"],
    ["right", "alignRight", "오른쪽"],
  ] as const) {
    add(en ? `Align ${alignment}` : `이미지 ${label} 정렬`, icon, () => {
      const tokens = String(editor.getAttributes("image").jwClassTokens ?? "")
        .split(/\s+/)
        .filter((token) => !token.startsWith("jw-image-align-"));
      tokens.push(`jw-image-align-${alignment}`);
      editor
        .chain()
        .focus()
        .updateAttributes("image", { jwClassTokens: tokens.sort().join(" ") })
        .run();
    });
  }
  add(en ? "Image settings" : "이미지 설정", "image", openImageSettings);
  add(en ? "Remove image" : "이미지 삭제", "remove", () =>
    editor.chain().focus().deleteSelection().run(),
  );
}
