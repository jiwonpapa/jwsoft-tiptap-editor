import { Editor } from "@tiptap/core";
import {
  DOMParser as ProseMirrorDOMParser,
  DOMSerializer,
} from "@tiptap/pm/model";
import {
  createEditorExtensions,
  type EditorModuleOptions,
} from "@/editor/modules";
import { sanitizePastedHtml } from "@/editor/pastePolicy";
import { analyzeLegacyHtml } from "@/policy/runtimePolicy";

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

function imageFiles(files: FileList | null | undefined): File[] {
  return [...(files ?? [])].filter((file) => file.type.startsWith("image/"));
}

export function createEditor(options: CreateEditorOptions): Editor {
  return new Editor({
    element: options.element,
    content: options.content,
    editable: options.editable,
    extensions: createEditorExtensions(options),
    editorProps: {
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
      handlePaste: (view, event) => {
        const files = imageFiles(event.clipboardData?.files);
        if (files.length && options.onImageFilesPasted) {
          event.preventDefault();
          options.onImageFilesPasted(files, view.state.selection.from);
          return true;
        }
        const plainText =
          event.clipboardData?.getData("text/plain").trim() ?? "";
        const selection = view.state.selection;
        if (
          options.onPlainUrlPasted &&
          plainText !== "" &&
          !/\s/u.test(plainText) &&
          selection.empty &&
          selection.$from.parent.type.name === "paragraph" &&
          selection.$from.parent.content.size === 0 &&
          options.onPlainUrlPasted(plainText, selection.from)
        ) {
          event.preventDefault();
          return true;
        }
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
