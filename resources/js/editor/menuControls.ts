import { editorIcon } from "@/editor/icons";

/** One control, two presentations: icon in the toolbar, named action in a panel. */
export function labelMenuAction(button: HTMLButtonElement): HTMLButtonElement {
  if (button.querySelector(".jwsoft-menu-text")) return button;
  const label =
    button.querySelector(".jwsoft-sr-only") ?? document.createElement("span");
  label.className = "jwsoft-menu-text";
  label.textContent =
    button.dataset.menuLabel ??
    button.getAttribute("aria-label") ??
    button.textContent;
  button.append(label);
  const check = editorIcon("check");
  check.classList.add("jwsoft-menu-check");
  button.append(check);
  button.dataset.editorCommand = "true";
  return button;
}

export function menuField(
  label: string,
  control: HTMLElement,
): HTMLLabelElement {
  const row = document.createElement("label");
  row.className = "jwsoft-format-row";
  row.append(document.createTextNode(label), control);
  return row;
}
