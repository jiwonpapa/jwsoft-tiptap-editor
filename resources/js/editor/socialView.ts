import type { NodeViewRenderer } from "@tiptap/core";
import { DOMSerializer } from "@tiptap/pm/model";
import { createElement, GripVertical, Trash2 } from "lucide";
import { createSocialPlayer } from "./socialPlayer";
import type { SocialOptions } from "./socialPolicy";

export const socialNodeView =
  (options: SocialOptions): NodeViewRenderer =>
  ({ node, editor, getPos }) => {
    let current = node;
    let signature = "";
    let player: ReturnType<typeof createSocialPlayer> = null;
    const dom = document.createElement("div");
    dom.className = "jwsoft-social-node";
    dom.contentEditable = "false";
    const content = document.createElement("div");
    const actions = document.createElement("div");
    actions.className = "jwsoft-media-actions";
    const english = window.G7Core?.locale?.current?.() === "en";
    for (const [label, icon, remove] of [
      [english ? "Select or drag card" : "카드 선택·이동", GripVertical, false],
      [english ? "Delete card" : "카드 삭제", Trash2, true],
    ] as const) {
      const button = document.createElement("button");
      button.type = "button";
      button.draggable = !remove;
      button.setAttribute("aria-label", label);
      button.title = label;
      button.append(
        createElement(icon, { width: 18, height: 18, "aria-hidden": "true" }),
      );
      button.addEventListener("click", () => {
        const pos = getPos();
        if (editor.isDestroyed || !editor.isEditable || typeof pos !== "number")
          return;
        if (remove)
          editor.commands.deleteRange({
            from: pos,
            to: pos + current.nodeSize,
          });
        else editor.commands.setNodeSelection(pos);
        editor.commands.focus();
      });
      actions.append(button);
    }
    dom.append(content, actions);
    const editableChanged = () => {
      actions.hidden = !editor.isEditable;
    };
    const render = () => {
      editableChanged();
      const next = JSON.stringify(current.attrs);
      if (next === signature) return;
      signature = next;
      player?.destroy();
      const figure = DOMSerializer.fromSchema(editor.schema).serializeNode(
        current,
      ) as HTMLElement;
      player = createSocialPlayer(
        String(current.attrs.url),
        String(current.attrs.provider),
        options,
      );
      if (player) figure.replaceChildren(player.dom);
      content.replaceChildren(figure);
    };
    editor.on("update", editableChanged);
    render();
    return {
      dom,
      update(next) {
        if (next.type !== current.type) return false;
        current = next;
        render();
        return true;
      },
      selectNode: () => dom.classList.add("ProseMirror-selectednode"),
      deselectNode: () => dom.classList.remove("ProseMirror-selectednode"),
      stopEvent: (event) =>
        !event.type.startsWith("drag") &&
        event.type !== "drop" &&
        event.target instanceof Element &&
        Boolean(
          event.target.closest(".jw-social-surface, .jwsoft-media-actions"),
        ),
      ignoreMutation: (mutation) => mutation.type !== "selection",
      destroy() {
        player?.destroy();
        editor.off("update", editableChanged);
      },
    };
  };
