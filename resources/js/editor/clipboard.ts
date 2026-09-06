import { DOMParser, DOMSerializer } from "@tiptap/pm/model";
import type { EditorProps } from "@tiptap/pm/view";
import { sanitizePastedHtml } from "@/editor/pastePolicy";
import { analyzeLegacyHtml } from "@/policy/runtimePolicy";
import { normalizeExternalInput } from "@/editor/socialInput";
import { insertPlainText } from "@/editor/plainTextPaste";

export interface ClipboardOptions {
  onPasteSanitized?: () => void;
  onImageFilesPasted?: (files: File[], position: number) => void;
  onPlainUrlPasted?: (url: string, position: number, end?: number) => boolean;
}

export function imageFiles(files: FileList | null | undefined): File[] {
  return [...(files ?? [])].filter((file) => file.type.startsWith("image/"));
}

function externalUrl(data: DataTransfer | null): string | null {
  const text = data?.getData("text/plain").trim() ?? "";
  const html = data?.getData("text/html") ?? "";
  return normalizeExternalInput(
    text.includes("<") ? text : !text || /\s/u.test(text) ? html || text : text,
  );
}

export function clipboardHandlers(
  options: ClipboardOptions,
): Pick<EditorProps, "handlePaste" | "handleDOMEvents"> {
  let plain = false;
  return {
    handleDOMEvents: {
      keydown: (_view, event) => {
        // ClipboardEvent has no modifiers. Track only public keyboard events;
        // Shift+Insert is ordinary paste, not paste-as-text.
        plain = event.shiftKey && event.key !== "Insert";
        return false;
      },
      keyup: (_view, event) => {
        plain = event.shiftKey;
        return false;
      },
      blur: () => {
        plain = false;
        return false;
      },
    },
    handlePaste: (view, event) => {
      if (!view.editable) return false;
      if (plain || view.state.selection.$from.parent.type.spec.code) {
        event.preventDefault();
        insertPlainText(view, event.clipboardData?.getData("text/plain") ?? "");
        return true;
      }
      const files = imageFiles(event.clipboardData?.files);
      if (files.length && options.onImageFilesPasted) {
        event.preventDefault();
        options.onImageFilesPasted(files, view.state.selection.from);
        return true;
      }
      const source = event.clipboardData?.getData("text/html") ?? "";
      const selection = view.state.selection;
      const url = externalUrl(event.clipboardData);
      if (
        options.onPlainUrlPasted &&
        url &&
        selection.empty &&
        selection.$from.parent.type.name === "paragraph" &&
        selection.$from.parent.content.size === 0 &&
        options.onPlainUrlPasted(url, selection.from)
      ) {
        event.preventDefault();
        return true;
      }
      if (!source) return false;
      const paste = sanitizePastedHtml(source);
      const wrapper = document.createElement("div");
      wrapper.innerHTML = paste.html;
      const slice = DOMParser.fromSchema(view.state.schema).parseSlice(
        wrapper,
        { preserveWhitespace: true },
      );
      const serialized = document.createElement("div");
      serialized.appendChild(
        DOMSerializer.fromSchema(view.state.schema).serializeFragment(
          slice.content,
        ),
      );
      if (
        paste.changed ||
        analyzeLegacyHtml(paste.html, serialized.innerHTML).hasLoss
      )
        options.onPasteSanitized?.();
      view.dispatch(view.state.tr.replaceSelection(slice).scrollIntoView());
      return true;
    },
  };
}
