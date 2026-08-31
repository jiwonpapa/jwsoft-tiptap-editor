import { editorIcon } from "@/editor/icons";
import {
  uploadEditorImage,
  validateEditorImageFile,
  type UploadedEditorImage,
} from "@/editor/imageUpload";
import { mountG7FilePicker } from "@/g7/filePicker";

interface QueueItem {
  file: File;
  preview: string;
  result?: UploadedEditorImage;
  state: "pending" | "uploading" | "done" | "error";
  controller?: AbortController;
  row: HTMLElement;
  status: HTMLElement;
  progress: HTMLProgressElement;
  retry: HTMLButtonElement;
}

export function createImageUploadQueue(options: {
  maxSizeMb: number;
  locale: string;
  onChange: () => void;
}) {
  const en = options.locale === "en";
  const element = document.createElement("div");
  element.className = "jwsoft-upload-workspace";
  const picker = document.createElement("div");
  picker.className = "jwsoft-native-picker";
  const fallback = document.createElement("button");
  fallback.type = "button";
  fallback.className = "jwsoft-upload-dropzone";
  fallback.append(editorIcon("upload"));
  const label = document.createElement("strong");
  label.textContent = en
    ? "Drop images here, or browse"
    : "이미지를 끌어놓거나 파일을 선택하세요";
  const hint = document.createElement("span");
  hint.textContent = `${en ? "Up to 10 images" : "최대 10장"} · ${options.maxSizeMb}MB · JPG, PNG, GIF, WebP, AVIF`;
  fallback.append(label, hint);
  const input = document.createElement("input");
  input.type = "file";
  input.multiple = true;
  input.accept = "image/jpeg,image/png,image/gif,image/webp,image/avif";
  input.hidden = true;
  input.setAttribute("aria-label", en ? "Image files" : "이미지 파일");
  const list = document.createElement("div");
  list.className = "jwsoft-upload-list";
  list.setAttribute("aria-live", "polite");
  const error = document.createElement("p");
  error.className = "jwsoft-tiptap-dialog-error";
  error.setAttribute("role", "alert");
  error.hidden = true;
  picker.append(fallback, input);
  element.append(picker, list, error);
  const items: QueueItem[] = [];
  let disposed = false;
  let uploading = false;
  let unmount: (() => void) | null = null;

  const update = (item: QueueItem, percent = 0) => {
    item.row.dataset.state = item.state;
    item.progress.value = percent;
    item.progress.hidden = item.state !== "uploading";
    item.retry.hidden = item.state !== "error";
    if (item.state !== "error")
      item.status.textContent =
        item.state === "done"
          ? en
            ? "Ready to insert"
            : "삽입 준비 완료"
          : item.state === "uploading"
            ? percent === 100
              ? en
                ? "Processing image…"
                : "이미지 처리 중…"
              : `${en ? "Uploading" : "업로드 중"} ${percent}%`
            : en
              ? "Ready to upload"
              : "업로드 대기";
    options.onChange();
  };
  const upload = async (item: QueueItem) => {
    item.controller = new AbortController();
    item.state = "uploading";
    update(item);
    try {
      const result = await uploadEditorImage(
        item.file,
        options.maxSizeMb,
        fetch,
        options.locale,
        {
          signal: item.controller.signal,
          onProgress: (percent) => {
            if (!disposed && items.includes(item)) update(item, percent);
          },
        },
      );
      if (disposed || !items.includes(item)) return;
      if (item.controller.signal.aborted) {
        item.state = "pending";
        update(item);
        return;
      }
      item.result = result;
      item.state = "done";
      update(item, 100);
    } catch (cause) {
      if (disposed || !items.includes(item)) return;
      item.state = item.controller.signal.aborted ? "pending" : "error";
      item.status.textContent =
        cause instanceof Error
          ? cause.message
          : en
            ? "Upload failed"
            : "업로드 실패";
      update(item);
    }
  };
  const addFiles = (files: File[]) => {
    error.hidden = true;
    for (const file of files) {
      if (items.some((item) => item.file === file)) continue;
      if (items.length >= 10) {
        error.textContent = en
          ? "Choose up to 10 images at a time."
          : "한 번에 최대 10장까지 선택할 수 있습니다.";
        error.hidden = false;
        break;
      }
      try {
        validateEditorImageFile(file, options.maxSizeMb, options.locale);
      } catch (cause) {
        error.textContent =
          cause instanceof Error ? cause.message : "Upload failed";
        error.hidden = false;
        continue;
      }
      const row = document.createElement("div");
      row.className = "jwsoft-upload-item";
      const preview = URL.createObjectURL(file);
      const img = document.createElement("img");
      img.src = preview;
      img.alt = file.name;
      img.addEventListener(
        "error",
        () => img.replaceWith(editorIcon("image")),
        { once: true },
      );
      const body = document.createElement("div");
      const name = document.createElement("strong");
      name.textContent = file.name;
      const status = document.createElement("span");
      const progress = document.createElement("progress");
      progress.max = 100;
      progress.setAttribute(
        "aria-label",
        `${file.name} ${en ? "upload progress" : "업로드 진행률"}`,
      );
      body.append(name, status, progress);
      const retry = document.createElement("button");
      retry.type = "button";
      retry.setAttribute(
        "aria-label",
        `${en ? "Retry" : "재시도"}: ${file.name}`,
      );
      retry.append(editorIcon("retry"));
      const remove = document.createElement("button");
      remove.type = "button";
      remove.setAttribute(
        "aria-label",
        `${en ? "Remove" : "선택 해제"}: ${file.name}`,
      );
      remove.append(editorIcon("close"));
      const item: QueueItem = {
        file,
        preview,
        row,
        status,
        progress,
        retry,
        state: "pending",
      };
      remove.addEventListener("click", () => {
        item.controller?.abort();
        URL.revokeObjectURL(item.preview);
        items.splice(items.indexOf(item), 1);
        row.remove();
        options.onChange();
      });
      retry.addEventListener("click", () => {
        if (!uploading) void upload(item);
      });
      row.append(img, body, retry, remove);
      list.append(row);
      items.push(item);
      update(item);
    }
    options.onChange();
  };
  fallback.addEventListener("click", () => input.click());
  input.addEventListener("change", () => {
    addFiles([...(input.files ?? [])]);
    input.value = "";
  });
  fallback.addEventListener("dragover", (event) => {
    event.preventDefault();
    fallback.dataset.dragging = "true";
  });
  fallback.addEventListener("dragleave", () => {
    delete fallback.dataset.dragging;
  });
  fallback.addEventListener("drop", (event) => {
    event.preventDefault();
    delete fallback.dataset.dragging;
    addFiles([...(event.dataTransfer?.files ?? [])]);
  });
  const clear = () => {
    for (const item of items) {
      item.controller?.abort();
      URL.revokeObjectURL(item.preview);
    }
    items.length = 0;
    list.replaceChildren();
    error.hidden = true;
    options.onChange();
  };
  return {
    element,
    mountNative: () => {
      if (unmount) return;
      const host = document.createElement("div");
      picker.append(host);
      try {
        unmount = mountG7FilePicker(host, {
          maxSizeMb: options.maxSizeMb,
          onFiles: addFiles,
          onReady: (ready) => {
            fallback.hidden = ready;
          },
          onError: (message) => {
            error.textContent = message;
            error.hidden = false;
          },
        });
      } catch {
        host.remove();
      }
      if (!unmount) host.remove();
    },
    get count() {
      return items.length;
    },
    get busy() {
      return items.some((item) => item.state === "uploading");
    },
    get ready() {
      return items.length > 0 && items.every((item) => item.state === "done");
    },
    uploadAll: async () => {
      uploading = true;
      try {
        for (const item of [...items]) {
          if (disposed || !element.closest("dialog")?.open) return null;
          if (items.includes(item) && !item.result) await upload(item);
        }
        return items.length && items.every((item) => item.result)
          ? items.map((item) => item.result!)
          : null;
      } finally {
        uploading = false;
      }
    },
    cancel: () => {
      for (const item of items) item.controller?.abort();
    },
    clear,
    destroy: () => {
      disposed = true;
      clear();
      unmount?.();
    },
  };
}
