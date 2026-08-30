import type { Editor } from "@tiptap/core";
import { editorIcon } from "@/editor/icons";
import { editorText } from "@/editor/locale";

export interface DialogHandle {
  element: HTMLDialogElement;
  trigger: HTMLButtonElement;
  close: (restoreFocus?: boolean) => void;
  onClose: (callback: () => void) => void;
}

let sequence = 0;

/** Native top-layer dialogs do not reflow the editor or inherit host clipping. */
export function createDialog(options: {
  title: string;
  trigger: HTMLButtonElement;
  content: HTMLElement;
  locale: string;
  editor: Editor;
  compact?: boolean;
}): DialogHandle {
  const dialog = document.createElement("dialog");
  dialog.setAttribute("role", "dialog");
  dialog.className = `jwsoft-tiptap-dialog${options.compact ? " jwsoft-dialog-compact" : ""}`;
  dialog.setAttribute("aria-modal", "true");
  const heading = document.createElement("h2");
  heading.id = `jwsoft-dialog-title-${++sequence}`;
  heading.textContent = options.title;
  dialog.setAttribute("aria-labelledby", heading.id);
  const header = document.createElement("header");
  header.className = "jwsoft-tiptap-dialog-header";
  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "jwsoft-tiptap-dialog-close";
  closeButton.setAttribute("aria-label", editorText(options.locale, "닫기"));
  closeButton.append(editorIcon("close"));
  header.append(heading, closeButton);
  dialog.append(header, options.content);
  const callbacks = new Set<() => void>();
  let bookmark = options.editor.state.selection.getBookmark();
  let scrollTop = "";
  let isOpen = false;
  const closed = (restoreFocus = true) => {
    if (!isOpen) return;
    isOpen = false;
    document.documentElement.style.overflow = scrollTop;
    options.trigger.setAttribute("aria-expanded", "false");
    for (const callback of callbacks) callback();
    if (restoreFocus && options.trigger.isConnected) {
      const menu = options.trigger.closest<HTMLElement>(
        ".jwsoft-tiptap-popover",
      );
      const owner = menu
        ? [
            ...document.querySelectorAll<HTMLButtonElement>(
              "button[aria-controls]",
            ),
          ].find((button) => button.getAttribute("aria-controls") === menu.id)
        : null;
      (owner ?? options.trigger).focus();
    }
  };
  const close = (restoreFocus = true) => {
    if (dialog.open) dialog.close();
    closed(restoreFocus);
  };
  options.trigger.setAttribute("aria-haspopup", "dialog");
  options.trigger.setAttribute("aria-expanded", "false");
  options.trigger.addEventListener("click", () => {
    if (dialog.open || options.editor.isDestroyed) return;
    bookmark = options.editor.state.selection.getBookmark();
    isOpen = true;
    scrollTop = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    options.trigger.setAttribute("aria-expanded", "true");
    dialog.showModal();
    dialog
      .querySelector<HTMLElement>(
        "[autofocus], input:not([type=file]):not([type=hidden]), [data-initial-focus]",
      )
      ?.focus();
  });
  // Restore the exact selection before form commands run; form focus must not
  // turn an image edit into an insertion or lose a selected link's range.
  options.content.addEventListener(
    "submit",
    () => {
      if (options.editor.isDestroyed) return;
      try {
        options.editor.view.dispatch(
          options.editor.state.tr.setSelection(
            bookmark.resolve(options.editor.state.doc),
          ),
        );
      } catch {
        /* A document transaction may have removed the original range. */
      }
    },
    true,
  );
  const mapBookmark = ({
    transaction,
  }: {
    transaction: import("@tiptap/pm/state").Transaction;
  }) => {
    if (isOpen) bookmark = bookmark.map(transaction.mapping);
  };
  options.editor.on("transaction", mapBookmark);
  closeButton.addEventListener("click", () => close());
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    close();
  });
  dialog.addEventListener("close", () => closed());
  dialog.addEventListener("click", (event) => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    )
      close();
  });
  options.editor.on("destroy", () => {
    close(false);
    options.editor.off("transaction", mapBookmark);
    dialog.remove();
  });
  return {
    element: dialog,
    trigger: options.trigger,
    close,
    onClose: (callback) => {
      callbacks.add(callback);
    },
  };
}
