import type { Editor } from "@tiptap/core";
import { NodeSelection } from "@tiptap/pm/state";
import type { DialogHandle } from "@/editor/dialog";
import { editorIcon } from "@/editor/icons";
import { createImageEditorDialog } from "@/features/image-editor/dialog";

export type EditorFeatureId = "image-editor";

export interface EditorFeatureFlags {
  imageEditor: boolean;
}

export interface FeatureControl extends HTMLButtonElement {
  __jwsoftUpdate?: (editable: boolean) => void;
}

export interface InstalledEditorFeature {
  id: EditorFeatureId;
  control: FeatureControl;
  dialog: DialogHandle;
}

function hasSelectedImage(editor: Editor): boolean {
  const { selection } = editor.state;
  return (
    selection instanceof NodeSelection && selection.node.type.name === "image"
  );
}

function featureButton(
  editor: Editor,
  id: EditorFeatureId,
  locale: string,
): FeatureControl {
  const label = locale === "en" ? "Edit image" : "이미지 편집";
  const control = document.createElement("button") as FeatureControl;
  control.type = "button";
  control.className = "jwsoft-tiptap-tool";
  control.title = label;
  control.setAttribute("aria-label", label);
  control.dataset.tooltip = label;
  control.dataset.editorFeature = id;
  control.append(editorIcon("editImage"));
  control.addEventListener("mousedown", (event) => event.preventDefault());
  control.__jwsoftUpdate = (editable) => {
    control.disabled = !editable || !hasSelectedImage(editor);
  };
  return control;
}

export function installEditorFeatures(options: {
  editor: Editor;
  flags: EditorFeatureFlags;
  maxSizeMb: number;
  locale: string;
}): InstalledEditorFeature[] {
  if (!options.flags.imageEditor) return [];
  const control = featureButton(options.editor, "image-editor", options.locale);
  return [
    {
      id: "image-editor",
      control,
      dialog: createImageEditorDialog({
        editor: options.editor,
        trigger: control,
        maxSizeMb: options.maxSizeMb,
        locale: options.locale,
      }),
    },
  ];
}
