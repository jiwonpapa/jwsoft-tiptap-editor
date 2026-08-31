import type { Editor, JSONContent } from "@tiptap/core";
import { closeHistory } from "@tiptap/pm/history";
import type { Transaction } from "@tiptap/pm/state";
import { editorText } from "@/editor/locale";
import { normalizeMediaUrl, type MediaEmbedOptions } from "@/editor/mediaEmbed";
import { fetchLinkPreview, isSmartCardUrl } from "@/editor/smartCard";

interface AutomaticUrlOptions {
  media: boolean;
  cards: boolean;
  mediaOptions: MediaEmbedOptions;
  status: HTMLElement;
  locale: string;
  request?: typeof fetch;
}

const latestStatus = new WeakMap<HTMLElement, symbol>();

/** Keep the URL in the document while fetching; replace only its unchanged, mapped range. */
export function insertAutomaticUrl(
  editor: Editor,
  url: string,
  position: number,
  end: number | undefined,
  options: AutomaticUrlOptions,
): boolean {
  const media = options.media
    ? normalizeMediaUrl(url, options.mediaOptions)
    : null;
  if (!media && (!options.cards || !isSmartCardUrl(url))) return false;
  const start = editor.state.doc.resolve(position);
  if (start.parent.type.name !== "paragraph") return false;
  const range = { from: start.before(), to: start.after() };
  // Only a whole URL paragraph or an empty paste destination is eligible.
  if (
    start.parent.content.size &&
    (position !== start.start() || end !== start.end())
  )
    return false;
  const content: JSONContent = media
    ? { type: "mediaEmbed", attrs: media }
    : {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: url,
            marks: [{ type: "link", attrs: { href: url } }],
          },
        ],
      };
  editor.view.dispatch(closeHistory(editor.state.tr));
  if (!editor.commands.insertContentAt(range, [content, { type: "paragraph" }]))
    return false;
  if (media) return true;

  let from = range.from + 1;
  let to = from + url.length;
  const originalSlice = editor.state.doc.slice(from, to);
  const controller = new AbortController();
  const operation = Symbol();
  latestStatus.set(options.status, operation);
  const status = (tone: string, text: string) => {
    if (latestStatus.get(options.status) !== operation || editor.isDestroyed)
      return;
    options.status.dataset.tone = tone;
    options.status.textContent = editorText(options.locale, text);
  };
  const stop = () => {
    editor.off("transaction", track);
    editor.off("destroy", cancel);
  };
  const cancel = () => {
    controller.abort();
    stop();
    status("neutral", "URL이 변경되어 자동 변환을 취소했습니다.");
  };
  const track = ({ transaction }: { transaction: Transaction }) => {
    for (const mapping of transaction.mapping.maps) {
      let touched = false;
      mapping.forEach((oldStart, oldEnd) => {
        if (
          oldStart === oldEnd
            ? oldStart >= from && oldStart <= to
            : oldStart < to && oldEnd > from
        )
          touched = true;
      });
      if (touched) {
        cancel();
        return;
      }
      from = mapping.map(from, 1);
      to = mapping.map(to, -1);
    }
    if (!transaction.doc.slice(from, to).eq(originalSlice)) cancel();
  };
  editor.on("transaction", track);
  editor.on("destroy", cancel);
  status("neutral", "링크 미리보기를 가져오는 중입니다…");
  void fetchLinkPreview(
    url,
    options.request ?? fetch,
    options.locale,
    controller.signal,
  )
    .then((preview) => {
      if (controller.signal.aborted || editor.isDestroyed) return;
      const current = editor.state.doc.resolve(from);
      if (
        current.parent.type.name !== "paragraph" ||
        current.parent.textContent !== url ||
        current.start() !== from ||
        current.end() !== to
      )
        return;
      stop();
      editor.view.dispatch(closeHistory(editor.state.tr));
      editor.commands.insertContentAt(
        { from: current.before(), to: current.after() },
        { type: "smartCard", attrs: preview },
        { updateSelection: false },
      );
      status("success", "링크 카드를 삽입했습니다.");
    })
    .catch(() => {
      if (!controller.signal.aborted)
        status(
          "warning",
          "미리보기를 가져오지 못해 원래 URL을 유지했습니다. 링크 카드 메뉴에서 다시 시도할 수 있습니다.",
        );
    })
    .finally(stop);
  return true;
}
