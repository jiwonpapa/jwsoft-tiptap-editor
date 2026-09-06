import type { Editor } from "@tiptap/core";
import { isAllowedEditorUrl } from "@/policy/runtimePolicy";

export interface LinkInput {
  href: string;
  text: string;
  title: string;
  newWindow: boolean;
}

/** User labels are schema text, never HTML. The server still owns persistence. */
export function applyEditorLink(editor: Editor, input: LinkInput): boolean {
  const href = input.href.trim();
  if (!editor.isEditable || !isAllowedEditorUrl(href)) return false;
  const attrs = {
    href,
    title: input.title.trim() || null,
    target: input.newWindow ? "_blank" : null,
    rel: input.newWindow ? "noopener noreferrer" : null,
  };
  return editor
    .chain()
    .focus()
    .extendMarkRange("link")
    .command(({ tr, state }) => {
      const { selection } = tr;
      const label = input.text.trim();
      if (!selection.empty && !label) {
        tr.addMark(
          selection.from,
          selection.to,
          state.schema.marks.link.create(attrs),
        );
      } else {
        const marks = (tr.storedMarks ?? selection.$from.marks()).filter(
          (mark) => mark.type.name !== "link",
        );
        const node = state.schema.text(label || href, [
          ...marks,
          state.schema.marks.link.create(attrs),
        ]);
        tr.replaceSelectionWith(node, false);
      }
      // Continuing to type after insertion must not silently extend the URL.
      tr.removeStoredMark(state.schema.marks.link);
      tr.setMeta("preventAutolink", true);
      return true;
    })
    .run();
}
