export function formField(
  labelText: string,
  input: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
): HTMLElement {
  const label = document.createElement("label");
  label.className = "jwsoft-tiptap-field";
  const text = document.createElement("span");
  text.textContent = labelText;
  label.append(text, input);
  return label;
}

export function formError(): HTMLElement {
  const error = document.createElement("div");
  error.className = "jwsoft-tiptap-dialog-error";
  error.setAttribute("role", "alert");
  error.hidden = true;
  return error;
}
