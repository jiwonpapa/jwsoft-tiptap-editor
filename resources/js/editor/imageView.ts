import type { NodeViewRenderer } from "@tiptap/core";
import { normalizeClassTokens } from "@/editor/classTokens";

export const resizableImageView: NodeViewRenderer = ({
  node,
  editor,
  getPos,
}) => {
  let current = node;
  const dom = document.createElement("figure");
  const image = document.createElement("img");
  const caption = document.createElement("figcaption");
  const handle = document.createElement("button");
  handle.type = "button";
  handle.className = "jwsoft-image-resize";
  handle.contentEditable = "false";
  handle.setAttribute("role", "slider");
  handle.setAttribute(
    "aria-label",
    window.G7Core?.locale?.current?.() === "en"
      ? "Image width"
      : "이미지 너비 조절",
  );
  handle.setAttribute("aria-valuemin", "10");
  handle.setAttribute("aria-valuemax", "100");
  dom.append(image, caption, handle);
  let startX = 0,
    startWidth = 0,
    parentWidth = 0,
    percent = 100;
  let dragging = false;
  let selected = false;
  const update = () => {
    const tokens = normalizeClassTokens(current.attrs.jwClassTokens);
    dom.className = `${tokens} jwsoft-image-node${selected ? " ProseMirror-selectednode" : ""}`;
    image.src = String(current.attrs.src ?? "");
    image.alt = String(current.attrs.alt ?? "");
    if (current.attrs.title) image.title = String(current.attrs.title);
    else image.removeAttribute("title");
    caption.textContent = String(current.attrs.caption ?? "");
    caption.hidden = !caption.textContent;
    percent = Number(/jw-image-size-(\d+)/.exec(tokens)?.[1] ?? 100);
    handle.setAttribute("aria-valuenow", String(percent));
    handle.setAttribute("aria-valuetext", `${percent}%`);
    handle.disabled = !editor.isEditable;
  };
  const commit = () => {
    const pos = getPos();
    if (typeof pos !== "number" || !editor.isEditable || editor.isDestroyed)
      return;
    const tokens = normalizeClassTokens(current.attrs.jwClassTokens)
      .split(/\s+/)
      .filter((token) => token && !token.startsWith("jw-image-size-"));
    if (!tokens.includes("jw-image")) tokens.push("jw-image");
    if (!tokens.some((token) => token.startsWith("jw-image-align-")))
      tokens.push("jw-image-align-center");
    tokens.push(`jw-image-size-${percent}`);
    editor.view.dispatch(
      editor.state.tr.setNodeMarkup(pos, undefined, {
        ...current.attrs,
        jwClassTokens: normalizeClassTokens(tokens.join(" ")),
      }),
    );
  };
  const move = (event: PointerEvent) => {
    if (!dragging) return;
    percent = Math.min(
      100,
      Math.max(
        10,
        Math.round(((startWidth + event.clientX - startX) / parentWidth) * 20) *
          5,
      ),
    );
    dom.style.width = `${percent}%`;
    handle.setAttribute("aria-valuenow", String(percent));
    handle.setAttribute("aria-valuetext", `${percent}%`);
  };
  const end = () => {
    if (!dragging) return;
    dragging = false;
    commit();
    dom.style.removeProperty("width");
    if (!dom.getAttribute("style")) dom.removeAttribute("style");
    document.removeEventListener("pointermove", move);
    document.removeEventListener("pointerup", end);
    document.removeEventListener("pointercancel", cancel);
  };
  const cancel = () => {
    dragging = false;
    dom.style.removeProperty("width");
    if (!dom.getAttribute("style")) dom.removeAttribute("style");
    document.removeEventListener("pointermove", move);
    document.removeEventListener("pointerup", end);
    document.removeEventListener("pointercancel", cancel);
  };
  handle.addEventListener("pointerdown", (event) => {
    if (!editor.isEditable || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    startX = event.clientX;
    startWidth = dom.getBoundingClientRect().width;
    const parent = dom.parentElement;
    const style = parent ? getComputedStyle(parent) : null;
    parentWidth =
      (parent?.clientWidth ?? startWidth) -
      parseFloat(style?.paddingLeft ?? "0") -
      parseFloat(style?.paddingRight ?? "0");
    if (parentWidth <= 0) return;
    dragging = true;
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", end);
    document.addEventListener("pointercancel", cancel);
  });
  handle.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    percent =
      event.key === "Home"
        ? 10
        : event.key === "End"
          ? 100
          : Math.min(
              100,
              Math.max(10, percent + (event.key === "ArrowRight" ? 5 : -5)),
            );
    commit();
  });
  const editableChanged = () => {
    handle.disabled = !editor.isEditable;
  };
  editor.on("update", editableChanged);
  update();
  return {
    dom,
    update(next) {
      if (next.type !== current.type) return false;
      current = next;
      update();
      return true;
    },
    selectNode() {
      selected = true;
      dom.classList.add("ProseMirror-selectednode");
    },
    deselectNode() {
      selected = false;
      dom.classList.remove("ProseMirror-selectednode");
    },
    stopEvent: (event) => event.target === handle,
    ignoreMutation: () => true,
    destroy() {
      cancel();
      editor.off("update", editableChanged);
    },
  };
};
