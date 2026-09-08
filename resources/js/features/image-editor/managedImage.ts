import { EDITOR_POLICY } from "@/generated/editorPolicy";

const MANAGED_PATH =
  /^\/api\/plugins\/jwsoft-tiptap-editor\/images\/([a-f0-9]{12})$/;
const EDITABLE_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

export interface ManagedImageSource {
  blob: Blob;
  hash: string;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
}

export function managedImageHash(source: string): string | null {
  try {
    const url = new URL(source, window.location.href);
    if (
      url.origin !== window.location.origin ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      return null;
    return MANAGED_PATH.exec(url.pathname)?.[1] ?? null;
  } catch {
    return null;
  }
}

export async function loadManagedImage(
  source: string,
  request: typeof fetch = fetch,
): Promise<ManagedImageSource> {
  const hash = managedImageHash(source);
  if (!hash) {
    throw new Error("jw-editor로 업로드한 이미지만 편집할 수 있습니다.");
  }
  const response = await request(source, {
    credentials: "same-origin",
    headers: { Accept: "image/jpeg,image/png,image/webp" },
  });
  if (!response.ok) throw new Error("편집할 이미지를 불러오지 못했습니다.");
  const blob = await response.blob();
  const mimeType = blob.type.toLowerCase().split(";", 1)[0];
  if (!EDITABLE_MIME.has(mimeType)) {
    throw new Error("GIF·AVIF는 원본 보존을 위해 편집하지 않습니다.");
  }
  if (blob.size < 1 || blob.size > EDITOR_POLICY.limits.maxImageBytes) {
    throw new Error("편집할 이미지가 허용 크기를 벗어났습니다.");
  }
  return {
    blob,
    hash,
    mimeType: mimeType as ManagedImageSource["mimeType"],
  };
}
