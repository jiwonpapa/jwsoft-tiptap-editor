import { Editor } from "@tiptap/core";
import {
  createEditorExtensions,
  type EditorModuleOptions,
} from "@/editor/modules";
import { clipboardHandlers, imageFiles } from "@/editor/clipboard";

interface CreateEditorOptions extends EditorModuleOptions {
  element: HTMLElement;
  content: string;
  editable: boolean;
  onUpdate: (html: string) => void;
  onPasteSanitized?: () => void;
  onImageFilesDropped?: (files: File[], position: number) => void;
  onImageFilesPasted?: (files: File[], position: number) => void;
  onPlainUrlPasted?: (url: string, position: number, end?: number) => boolean;
}

export function createEditor(options: CreateEditorOptions): Editor {
  return new Editor({
    element: options.element,
    content: options.content,
    editable: options.editable,
    extensions: createEditorExtensions(options),
    editorProps: {
      ...clipboardHandlers(options),
      attributes: {
        class: "jwsoft-tiptap-editable",
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": "jw-editor",
      },
      handleDrop: (view, event) => {
        const files = imageFiles(event.dataTransfer?.files);
        if (!files.length || !options.onImageFilesDropped) return false;
        event.preventDefault();
        const position =
          view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos ??
          view.state.selection.from;
        options.onImageFilesDropped(files, position);
        return true;
      },
      handleKeyDown: (view, event) => {
        if (
          event.key !== "Enter" ||
          event.shiftKey ||
          event.ctrlKey ||
          event.metaKey ||
          event.altKey ||
          event.isComposing ||
          view.composing ||
          !options.onPlainUrlPasted
        )
          return false;
        const { selection } = view.state;
        const paragraph = selection.$from.parent;
        const url = paragraph.textContent;
        if (
          !selection.empty ||
          paragraph.type.name !== "paragraph" ||
          selection.$from.parentOffset !== paragraph.content.size ||
          !url ||
          /\s/u.test(url) ||
          selection.$from.marks().some((mark) => mark.type.name === "code")
        )
          return false;
        if (
          !options.onPlainUrlPasted(
            url,
            selection.$from.start(),
            selection.$from.end(),
          )
        )
          return false;
        event.preventDefault();
        return true;
      },
    },
    onUpdate: ({ editor }) => options.onUpdate(editor.getHTML()),
  });
}
