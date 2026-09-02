import type { Editor } from "@tiptap/core";
import type { Transaction } from "@tiptap/pm/state";

/** A pending insertion follows document edits and is cancelled when its target disappears. */
export function trackAsyncPosition(editor: Editor, initial: number) {
  const controller = new AbortController();
  let position = initial;
  const dispose = () => {
    editor.off("transaction", track);
    editor.off("destroy", cancel);
  };
  const cancel = () => {
    controller.abort();
    dispose();
  };
  const track = ({ transaction }: { transaction: Transaction }) => {
    const mapped = transaction.mapping.mapResult(position, 1);
    position = mapped.pos;
    if (mapped.deletedAcross || !editor.isEditable) cancel();
  };
  editor.on("transaction", track);
  editor.on("destroy", cancel);
  if (editor.isDestroyed || !editor.isEditable) cancel();
  return {
    signal: controller.signal,
    getPosition: () => position,
    dispose,
  };
}
