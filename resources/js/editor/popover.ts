import { editorIcon, type EditorIcon } from "@/editor/icons";

export function createPopover(label: string, icon: EditorIcon = "more") {
  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "jwsoft-tiptap-tool";
  trigger.setAttribute("aria-label", label);
  trigger.title = label;
  trigger.dataset.tooltip = label;
  trigger.append(editorIcon(icon));
  const panel = document.createElement("div");
  panel.className = "jwsoft-tiptap-popover";
  panel.popover = "auto";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", label);
  trigger.setAttribute("aria-haspopup", "dialog");
  trigger.setAttribute("aria-expanded", "false");
  const position = () => {
    const rect = trigger.getBoundingClientRect();
    const viewport = window.visualViewport;
    const width = viewport?.width ?? window.innerWidth;
    const height = viewport?.height ?? window.innerHeight;
    panel.style.left =
      Math.max(8, Math.min(rect.left, width - panel.offsetWidth - 8)) + "px";
    panel.style.top =
      Math.max(8, Math.min(rect.bottom + 6, height - panel.offsetHeight - 8)) +
      "px";
  };
  trigger.addEventListener("click", () => {
    if (panel.matches(":popover-open")) panel.hidePopover();
    else {
      panel.showPopover();
      position();
    }
  });
  panel.addEventListener("toggle", () => {
    trigger.setAttribute(
      "aria-expanded",
      String(panel.matches(":popover-open")),
    );
  });
  const resize = () => {
    if (panel.matches(":popover-open")) position();
  };
  const escape = (event: KeyboardEvent) => {
    if (event.key === "Escape" && panel.matches(":popover-open")) {
      event.preventDefault();
      panel.hidePopover();
      trigger.focus();
    }
  };
  document.addEventListener("keydown", escape);
  window.addEventListener("resize", resize);
  window.visualViewport?.addEventListener("resize", resize);
  return {
    trigger,
    panel,
    close: () => {
      if (panel.matches(":popover-open")) panel.hidePopover();
    },
    destroy: () => {
      window.removeEventListener("resize", resize);
      window.visualViewport?.removeEventListener("resize", resize);
      document.removeEventListener("keydown", escape);
      panel.remove();
    },
  };
}
