import { Editor } from "@tiptap/core";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { Table, TableKit } from "@tiptap/extension-table";
import {
  DOMParser as ProseMirrorDOMParser,
  DOMSerializer,
  type DOMOutputSpec,
} from "@tiptap/pm/model";
import StarterKit from "@tiptap/starter-kit";

import { ClassTokenExtension } from "@/editor/classTokens";
import { sanitizePastedHtml } from "@/editor/pastePolicy";
import { analyzeLegacyHtml } from "@/policy/runtimePolicy";

const PolicyTable = Table.extend({
  renderHTML({ HTMLAttributes }): DOMOutputSpec {
    return ["table", HTMLAttributes, ["tbody", 0]];
  },
});

interface CreateEditorOptions {
  element: HTMLElement;
  content: string;
  placeholder: string;
  editable: boolean;
  onUpdate: (html: string) => void;
  onPasteSanitized?: () => void;
}

export function createEditor(options: CreateEditorOptions): Editor {
  return new Editor({
    element: options.element,
    content: options.content,
    editable: options.editable,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
        link: {
          defaultProtocol: "https",
          openOnClick: false,
          protocols: ["https", "mailto", "tel"],
          HTMLAttributes: {
            target: null,
            rel: null,
            class: null,
          },
        },
      }),
      Image.configure({ allowBase64: false }),
      TableKit.configure({ table: false }),
      PolicyTable.configure({ resizable: false, View: null }),
      ClassTokenExtension,
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
      handlePaste: (view, event) => {
        const source = event.clipboardData?.getData("text/html") ?? "";
        if (!source) return false;
        const paste = sanitizePastedHtml(source);
        const wrapper = document.createElement("div");
        wrapper.innerHTML = paste.html;
        const slice = ProseMirrorDOMParser.fromSchema(
          view.state.schema,
        ).parseSlice(wrapper, { preserveWhitespace: true });
        const serialized = document.createElement("div");
        serialized.appendChild(
          DOMSerializer.fromSchema(view.state.schema).serializeFragment(
            slice.content,
          ),
        );
        if (
          paste.changed ||
          analyzeLegacyHtml(paste.html, serialized.innerHTML).hasLoss
        ) {
          options.onPasteSanitized?.();
        }
        view.dispatch(view.state.tr.replaceSelection(slice).scrollIntoView());
        return true;
      },
    },
    onUpdate: ({ editor }) => options.onUpdate(editor.getHTML()),
  });
}
