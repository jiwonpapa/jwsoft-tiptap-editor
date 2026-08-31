import { injectContentStyles } from "@/editor/editorStyles";
import { startContentMediaObserver } from "@/editor/mediaRenderer";
import { mediaPlaybackOptions } from "@/editor/mediaPlayer";
import { socialOptions } from "@/editor/socialPolicy";
import { startContentSocialObserver } from "@/editor/socialRenderer";
import type { G7Action } from "@/g7/types";

export function injectContentStylesHandler(
  action: G7Action,
  _context: unknown,
): void {
  injectContentStyles();
  const params = action.params ?? {};
  queueMicrotask(() => {
    startContentSocialObserver(socialOptions(params));
    startContentMediaObserver(
      mediaPlaybackOptions(params.externalMediaLoadMode, params.mediaAutoplay),
    );
  });
}
