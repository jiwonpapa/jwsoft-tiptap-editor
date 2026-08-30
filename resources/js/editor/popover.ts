import type { Editor } from "@tiptap/core";
import type { SelectionBookmark, Transaction } from "@tiptap/pm/state";
import { editorIcon, type EditorIcon } from "@/editor/icons";

let sequence = 0;

export function createPopover(
  label: string,
  icon: EditorIcon = "more",
  options: { editor?: Editor; locale?: string; sheet?: boolean } = {},
) {
  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "jwsoft-tiptap-tool";
  trigger.setAttribute("aria-label", label);
  trigger.title = label;
  trigger.dataset.tooltip = label;
  trigger.append(editorIcon(icon));
  const panel = document.createElement("dialog");
  panel.className = "jwsoft-tiptap-popover";
  panel.popover = "auto";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", label);
  panel.id = `jwsoft-menu-${++sequence}`;
  trigger.setAttribute("aria-controls", panel.id);
  trigger.setAttribute("aria-haspopup", "dialog");
  trigger.setAttribute("aria-expanded", "false");
  const header = document.createElement("header");
  header.className = "jwsoft-popover-header";
  const heading = document.createElement("span");
  heading.textContent = label;
  const dismiss = document.createElement("button");
  dismiss.type = "button";
  dismiss.className = "jwsoft-tiptap-tool jwsoft-popover-close";
  dismiss.setAttribute(
    "aria-label",
    options.locale === "en" ? "Close" : "닫기",
  );
  dismiss.append(editorIcon("close"));
  header.append(heading, dismiss);
  panel.append(header);

  let bookmark: SelectionBookmark | null = null;
  let opened = false;
  let sheet = false;
  let lockedOverflow: string | null = null;
  const editor = options.editor;
  const isOpen = () =>
    panel.open ||
    (typeof panel.showPopover === "function" && panel.matches(":popover-open"));
  const restoreSelection = () => {
    if (!bookmark || !editor || editor.isDestroyed) return;
    try {
      const selection = bookmark.resolve(editor.state.doc);
      if (!selection.eq(editor.state.selection))
        editor.view.dispatch(editor.state.tr.setSelection(selection));
    } catch {
      /* A transaction may have removed the original selection. */
    }
  };
  const closed = () => {
    opened = false;
    bookmark = null;
    if (lockedOverflow !== null) {
      document.documentElement.style.overflow = lockedOverflow;
      lockedOverflow = null;
    }
    trigger.setAttribute("aria-expanded", "false");
  };
  const close = (focus: "trigger" | "editor" | false = false) => {
    if (!opened && !isOpen()) return;
    if (panel.open) panel.close();
    else if (isOpen()) panel.hidePopover();
    closed();
    if (focus === "trigger" && trigger.isConnected) trigger.focus();
    if (focus === "editor" && editor && !editor.isDestroyed)
      editor.view.focus();
  };
  const position = () => {
    if (!isOpen()) return;
    const rect = trigger.getBoundingClientRect();
    const viewport = window.visualViewport;
    const width = viewport?.width ?? window.innerWidth;
    const height = viewport?.height ?? window.innerHeight;
    const left = viewport?.offsetLeft ?? 0;
    const top = viewport?.offsetTop ?? 0;
    panel.style.width = sheet ? `${width - 16}px` : "";
    panel.style.maxHeight = `${Math.max(80, Math.min(sheet ? 640 : 720, height - 24))}px`;
    panel.style.left = `${sheet ? left + 8 : Math.max(left + 8, Math.min(rect.left, left + width - panel.offsetWidth - 8))}px`;
    const below = rect.bottom + 6;
    const above = rect.top - panel.offsetHeight - 6;
    const candidate =
      below + panel.offsetHeight <= top + height - 8 ? below : above;
    panel.style.top = `${sheet ? Math.max(top + 8, top + height - panel.offsetHeight - 8) : Math.max(top + 8, Math.min(candidate, top + height - panel.offsetHeight - 8))}px`;
  };
  const availableControls = () =>
    [
      ...panel.querySelectorAll<HTMLElement>(
        "button:not(:disabled), select:not(:disabled), input:not(:disabled)",
      ),
    ].filter(
      (element) =>
        !element.closest("[hidden]") && element.getClientRects().length > 0,
    );
  const open = () => {
    if (trigger.disabled || editor?.isDestroyed || isOpen()) return;
    document.dispatchEvent(
      new CustomEvent("jwsoft-menu-opening", { detail: panel }),
    );
    bookmark = editor?.state.selection.getBookmark() ?? null;
    sheet =
      options.sheet !== false &&
      (window.visualViewport?.width ?? window.innerWidth) <= 640;
    panel.dataset.presentation = sheet ? "sheet" : "popover";
    opened = true;
    if (sheet || typeof panel.showPopover !== "function") {
      lockedOverflow = document.documentElement.style.overflow;
      document.documentElement.style.overflow = "hidden";
      panel.setAttribute("aria-modal", "true");
      panel.showModal();
    } else {
      panel.setAttribute("aria-modal", "false");
      panel.showPopover();
    }
    trigger.setAttribute("aria-expanded", "true");
    position();
    (
      availableControls().find((control) => control !== dismiss) ?? dismiss
    ).focus({ preventScroll: true });
  };
  trigger.addEventListener("click", () =>
    isOpen() ? close("trigger") : open(),
  );
  trigger.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowDown") return;
    event.preventDefault();
    open();
  });
  dismiss.addEventListener("click", () => close("trigger"));
  panel.addEventListener("cancel", (event) => {
    event.preventDefault();
    close("trigger");
  });
  panel.addEventListener("close", () => {
    if (!isOpen()) closed();
  });
  panel.addEventListener("toggle", () => {
    if (isOpen()) trigger.setAttribute("aria-expanded", "true");
    else closed();
  });
  panel.addEventListener(
    "click",
    (event) => {
      if (!(event.target instanceof Element)) return;
      const command = event.target.closest<HTMLElement>(
        "[data-editor-command]",
      );
      if (!command) return;
      restoreSelection();
      // Close the parent before opening an input dialog; never stack two modals.
      if (command.getAttribute("aria-haspopup") === "dialog") close(false);
    },
    true,
  );
  panel.addEventListener(
    "change",
    (event) => {
      const target = event.target;
      const value = target instanceof HTMLSelectElement ? target.value : null;
      restoreSelection();
      if (target instanceof HTMLSelectElement && value !== null)
        target.value = value;
    },
    true,
  );
  panel.addEventListener("change", (event) => {
    if (isOpen() && event.target instanceof HTMLElement)
      event.target.focus({ preventScroll: true });
  });
  panel.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    if (event.target.closest("[data-editor-command]")) close("editor");
    if (event.target === panel && panel.open) {
      const rect = panel.getBoundingClientRect();
      if (
        event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom
      )
        close("trigger");
    }
  });
  panel.addEventListener("keydown", (event) => {
    if (event.key === "Tab" && panel.open) {
      const controls = availableControls();
      const first = controls[0],
        last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
      return;
    }
    if (
      !(event.target instanceof HTMLButtonElement) ||
      !["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)
    )
      return;
    const controls = availableControls();
    const current = controls.indexOf(event.target);
    if (!controls.length || current < 0) return;
    event.preventDefault();
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? controls.length - 1
          : (current + (event.key === "ArrowDown" ? 1 : -1) + controls.length) %
            controls.length;
    controls[next].focus();
  });
  const escape = (event: KeyboardEvent) => {
    if (event.key === "Escape" && isOpen()) {
      event.preventDefault();
      close("trigger");
    }
  };
  const anotherMenu = (event: Event) => {
    if ((event as CustomEvent).detail !== panel) close(false);
  };
  const mapBookmark = ({ transaction }: { transaction: Transaction }) => {
    if (opened && bookmark) bookmark = bookmark.map(transaction.mapping);
  };
  editor?.on("transaction", mapBookmark);
  document.addEventListener("jwsoft-menu-opening", anotherMenu);
  document.addEventListener("keydown", escape, true);
  window.addEventListener("resize", position);
  window.addEventListener("scroll", position, true);
  window.visualViewport?.addEventListener("resize", position);
  window.visualViewport?.addEventListener("scroll", position);
  return {
    trigger,
    panel,
    open,
    close,
    destroy: () => {
      close(false);
      editor?.off("transaction", mapBookmark);
      document.removeEventListener("jwsoft-menu-opening", anotherMenu);
      document.removeEventListener("keydown", escape, true);
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", position, true);
      window.visualViewport?.removeEventListener("resize", position);
      window.visualViewport?.removeEventListener("scroll", position);
      panel.remove();
    },
  };
}
