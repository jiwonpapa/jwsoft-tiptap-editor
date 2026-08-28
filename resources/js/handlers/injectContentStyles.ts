import { injectContentStyles } from "@/editor/editorStyles";
import type { G7Action } from "@/g7/types";

export function injectContentStylesHandler(
  _action: G7Action,
  _context: unknown,
): void {
  injectContentStyles();
}
