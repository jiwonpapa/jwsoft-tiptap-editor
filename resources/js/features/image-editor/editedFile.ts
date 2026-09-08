import type { ImageEditorData } from "@/features/image-editor/vendorTypes";
import type { ManagedImageSource } from "@/features/image-editor/managedImage";

const OUTPUT = {
  "image/jpeg": { extension: "jpg", editorExtension: "jpeg", quality: 0.92 },
  "image/png": { extension: "png", editorExtension: "png", quality: 1 },
  "image/webp": { extension: "webp", editorExtension: "webp", quality: 0.92 },
} as const;

export function imageEditorOutput(source: ManagedImageSource): {
  extension: string;
  editorExtension: string;
  quality: number;
} {
  return OUTPUT[source.mimeType];
}

function canvasBlob(
  canvas: HTMLCanvasElement,
  mimeType: ManagedImageSource["mimeType"],
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new Error("편집 이미지를 만들지 못했습니다.")),
      mimeType,
      quality,
    );
  });
}

function base64Blob(value: string, mimeType: string): Blob {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([a-z0-9+/=]+)$/i.exec(
    value,
  );
  if (!match || match[1].toLowerCase() !== mimeType) {
    throw new Error("편집 이미지 형식이 올바르지 않습니다.");
  }
  const binary = window.atob(match[2]);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new Blob([bytes], { type: mimeType });
}

export async function createEditedFile(
  data: ImageEditorData,
  source: ManagedImageSource,
  timestamp: number = Date.now(),
): Promise<File> {
  const output = imageEditorOutput(source);
  const blob = data.imageBase64
    ? base64Blob(data.imageBase64, source.mimeType)
    : data.imageCanvas
      ? await canvasBlob(data.imageCanvas, source.mimeType, output.quality)
      : null;
  if (!blob || blob.size < 1 || blob.type !== source.mimeType) {
    throw new Error("편집 결과를 이미지 파일로 만들지 못했습니다.");
  }
  return new File(
    [blob],
    `${source.hash}-edited-${timestamp}.${output.extension}`,
    { type: source.mimeType, lastModified: timestamp },
  );
}
