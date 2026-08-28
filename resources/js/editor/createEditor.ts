import { Editor } from "@tiptap/core";
import Placeholder from "@tiptap/extension-placeholder";
import StarterKit from "@tiptap/starter-kit";

interface CreateEditorOptions {
  element: HTMLElement;
  content: string;
  placeholder: string;
  editable: boolean;
  onUpdate: (html: string) => void;
}

export function createEditor(options: CreateEditorOptions): Editor {
  return new Editor({
    element: options.element,
    content: options.content,
    editable: options.editable,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
      }),
      Placeholder.configure({
        placeholder: options.placeholder,
      }),
    ],
    editorProps: {
      attributes: {
        class: "jwsoft-tiptap-editable",
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": "JWSoft Tiptap editor",
      },
    },
    onUpdate: ({ editor }) => options.onUpdate(editor.getHTML()),
  });
}
