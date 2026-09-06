import { Fragment, Slice } from "@tiptap/pm/model";
import type { EditorView } from "@tiptap/pm/view";

/** Build text nodes directly: strings that look like HTML remain visible text. */
export function insertPlainText(view: EditorView, input: string): boolean {
  if (!view.editable) return false;
  const text = input.replace(/\r\n?/gu, "\n");
  if (!text) return false;
  const { state } = view;
  const transaction = state.tr;
  if (state.selection.$from.parent.type.spec.code) {
    transaction.insertText(text);
  } else {
    const paragraphs = text
      .split("\n")
      .map((line) =>
        state.schema.nodes.paragraph.create(
          null,
          line ? state.schema.text(line) : null,
        ),
      );
    transaction.replaceSelection(
      new Slice(Fragment.fromArray(paragraphs), 1, 1),
    );
  }
  view.dispatch(
    transaction
      .setMeta("paste", true)
      // No uiEvent=paste: Tiptap paste rules would reapply links/markdown.
      .setMeta("preventAutolink", true)
      .scrollIntoView(),
  );
  return true;
}
