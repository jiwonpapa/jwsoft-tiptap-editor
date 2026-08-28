import { editorContainerId } from "@/editor/content";
import { editorRegistry } from "@/editor/editorRegistry";
import type { G7Action } from "@/g7/types";

export async function destroyEditorHandler(
  action: G7Action,
  _context: unknown,
): Promise<void> {
  const name =
    typeof action.params?.name === "string" ? action.params.name : "content";
  const containerId = editorContainerId(name);
  editorRegistry.destroy(containerId);
  const container = document.getElementById(containerId);
  container?.replaceChildren();
  container?.style.removeProperty("--jwsoft-tiptap-height");
}
