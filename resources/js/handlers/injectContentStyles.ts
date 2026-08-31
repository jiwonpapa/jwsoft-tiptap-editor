import { injectContentStyles } from "@/editor/editorStyles";
import {
  startContentMediaObserver,
  type ExternalMediaLoadMode,
} from "@/editor/mediaRenderer";
import { booleanParam } from "@/editor/content";
import type { G7Action } from "@/g7/types";

export function injectContentStylesHandler(
  action: G7Action,
  _context: unknown,
): void {
  injectContentStyles();
  const params = action.params ?? {};
  const loadMode: ExternalMediaLoadMode =
    params.externalMediaLoadMode === "immediate" ? "immediate" : "click";
  queueMicrotask(() => {
    startContentMediaObserver({
      loadMode,
      autoplay: booleanParam(params.mediaAutoplay),
    });
  });
}
