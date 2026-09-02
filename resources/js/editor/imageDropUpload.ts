import type { Editor } from "@tiptap/core";
import { uploadEditorImage } from "@/editor/imageUpload";
import { DEFAULT_IMAGE_CLASS_TOKENS } from "@/editor/imageNode";
import { editorText } from "@/editor/locale";
import { trackAsyncPosition } from "@/editor/asyncPosition";

async function uploadImageFiles(options: {
  editor: Editor;
  files: File[];
  position: number;
  maxSizeMb: number;
  locale: string;
  status: HTMLElement;
}): Promise<void> {
  const files = options.files.slice(0, 20);
  const insertion = trackAsyncPosition(options.editor, options.position);
  let completed = 0;
  options.status.dataset.tone = "neutral";

  try {
    for (const file of files) {
      if (insertion.signal.aborted) return;
      options.status.textContent = editorText(
        options.locale,
        "이미지 {{current}}/{{total}} 업로드 중…",
        { current: completed + 1, total: files.length },
      );
      const uploaded = await uploadEditorImage(
        file,
        options.maxSizeMb,
        fetch,
        options.locale,
        { signal: insertion.signal },
      );
      if (insertion.signal.aborted || options.editor.isDestroyed) return;
      const inserted = options.editor.commands.insertContentAt(
        insertion.getPosition(),
        {
          type: "image",
          attrs: {
            src: uploaded.url,
            alt: uploaded.originalName,
            jwClassTokens: DEFAULT_IMAGE_CLASS_TOKENS,
          },
        },
        { updateSelection: false },
      );
      if (!inserted)
        throw new Error(
          editorText(options.locale, "이미지 삽입에 실패했습니다."),
        );
      completed += 1;
    }
    options.status.dataset.tone = "success";
    options.status.textContent = editorText(
      options.locale,
      "이미지 {{count}}개를 업로드해 삽입했습니다.",
      { count: completed },
    );
  } catch (error) {
    if (insertion.signal.aborted || options.editor.isDestroyed) return;
    options.status.dataset.tone = "warning";
    options.status.textContent =
      error instanceof Error
        ? error.message
        : editorText(options.locale, "이미지 업로드에 실패했습니다.");
  } finally {
    insertion.dispose();
  }
}

export function startImageUpload(
  options: Parameters<typeof uploadImageFiles>[0],
): void {
  uploadImageFiles(options).catch(() => {
    options.status.dataset.tone = "warning";
    options.status.textContent = editorText(
      options.locale,
      "이미지 업로드에 실패했습니다.",
    );
  });
}
