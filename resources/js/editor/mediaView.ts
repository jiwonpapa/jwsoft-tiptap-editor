import type { NodeViewRenderer } from "@tiptap/core";
import { createElement, GripVertical, Trash2 } from "lucide";
import { normalizeMediaUrl } from "@/editor/mediaEmbed";
import {
  createMediaPlayer,
  type MediaPlaybackOptions,
} from "@/editor/mediaPlayer";

export const mediaNodeView =
  (options: MediaPlaybackOptions): NodeViewRenderer =>
  ({ node, editor, getPos }) => {
    let current = node;
    let signature = "";
    let player: ReturnType<typeof createMediaPlayer> | undefined;
    const dom = document.createElement("div");
    dom.className = "jwsoft-media-node";
    dom.contentEditable = "false";
    const figure = document.createElement("figure");
    const actions = document.createElement("div");
    actions.className = "jwsoft-media-actions";
    const english = window.G7Core?.locale?.current?.() === "en";
    actions.setAttribute("role", "group");
    actions.setAttribute(
      "aria-label",
      english ? "Video editing" : "동영상 편집",
    );
    const select = document.createElement("button");
    select.type = "button";
    select.draggable = true;
    select.setAttribute(
      "aria-label",
      english ? "Select or drag video" : "동영상 선택·이동",
    );
    select.title = select.getAttribute("aria-label")!;
    select.append(
      createElement(GripVertical, {
        width: 18,
        height: 18,
        "aria-hidden": "true",
      }),
    );
    const remove = document.createElement("button");
    remove.type = "button";
    remove.setAttribute("aria-label", english ? "Delete video" : "동영상 삭제");
    remove.title = remove.getAttribute("aria-label")!;
    remove.append(
      createElement(Trash2, { width: 18, height: 18, "aria-hidden": "true" }),
    );
    actions.append(select, remove);
    dom.append(figure, actions);
    const position = () => {
      const pos = getPos();
      return !editor.isDestroyed && editor.isEditable && typeof pos === "number"
        ? pos
        : null;
    };
    select.addEventListener("click", () => {
      const pos = position();
      if (pos !== null) {
        editor.commands.setNodeSelection(pos);
        editor.commands.focus();
      }
    });
    remove.addEventListener("click", () => {
      const pos = position();
      if (pos !== null) {
        editor.commands.deleteRange({ from: pos, to: pos + current.nodeSize });
        editor.commands.focus();
      }
    });
    const editableChanged = () => {
      actions.hidden = !editor.isEditable;
    };
    const update = () => {
      editableChanged();
      const nextSignature = JSON.stringify([
        current.attrs.sourceUrl,
        current.attrs.provider,
        current.attrs.ratio,
        current.attrs.title,
      ]);
      if (signature === nextSignature) return;
      signature = nextSignature;
      player?.destroy();
      const media = normalizeMediaUrl(String(current.attrs.sourceUrl ?? ""));
      if (!media || media.provider !== current.attrs.provider) {
        figure.replaceChildren();
        return;
      }
      const portrait = current.attrs.ratio === "9x16";
      dom.classList.toggle("jwsoft-media-portrait", portrait);
      figure.className = `jw-media jw-media-${portrait ? "9x16" : "16x9"} jw-media-${media.provider}`;
      player = createMediaPlayer(
        { ...media, title: String(current.attrs.title || media.title) },
        options,
      );
      figure.replaceChildren(player.dom);
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
      selectNode: () => dom.classList.add("ProseMirror-selectednode"),
      deselectNode: () => dom.classList.remove("ProseMirror-selectednode"),
      stopEvent: (event) => {
        if (event.type.startsWith("drag") || event.type === "drop")
          return false;
        return (
          event.target instanceof Element &&
          Boolean(
            event.target.closest(".jw-media-surface, .jwsoft-media-actions"),
          )
        );
      },
      ignoreMutation: (mutation) => mutation.type !== "selection",
      destroy() {
        editor.off("update", editableChanged);
        player?.destroy();
      },
    };
  };
