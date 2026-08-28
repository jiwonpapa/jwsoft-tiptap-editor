import { EDITOR_POLICY } from "@/generated/editorPolicy";
import { isAllowedEditorUrl } from "@/policy/runtimePolicy";

const ENDPOINT = "/api/plugins/jwsoft-tiptap-editor/upload";

export interface UploadedEditorImage {
  url: string;
  originalName: string;
}

interface UploadPayload {
  success?: boolean;
  message?: string;
  data?: { download_url?: unknown; original_name?: unknown };
}

export function validateEditorImageFile(file: File, maxSizeMb: number): void {
  const allowed = EDITOR_POLICY.media.allowedMimeTypes as readonly string[];
  if (!allowed.includes(file.type)) {
    throw new Error(
      "JPEG, PNG, GIF, WebP, AVIF 이미지만 업로드할 수 있습니다.",
    );
  }
  const configured =
    Math.max(1, Math.min(10, Math.floor(maxSizeMb))) * 1024 * 1024;
  const maximum = Math.min(configured, EDITOR_POLICY.limits.maxImageBytes);
  if (file.size < 1 || file.size > maximum) {
    throw new Error(
      `이미지는 ${Math.round(maximum / 1024 / 1024)}MB 이하여야 합니다.`,
    );
  }
}

function authorizationHeaders(): HeadersInit {
  try {
    const token = window.localStorage.getItem("auth_token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

export async function uploadEditorImage(
  file: File,
  maxSizeMb: number,
  request: typeof fetch = fetch,
): Promise<UploadedEditorImage> {
  validateEditorImageFile(file, maxSizeMb);
  const form = new FormData();
  form.append("upload", file);
  const response = await request(ENDPOINT, {
    method: "POST",
    credentials: "same-origin",
    headers: { Accept: "application/json", ...authorizationHeaders() },
    body: form,
  });

  let payload: UploadPayload | null = null;
  try {
    payload = (await response.json()) as UploadPayload;
  } catch {
    // 서버의 비 JSON 오류 본문은 사용자에게 노출하지 않습니다.
  }
  const url = payload?.data?.download_url;
  if (
    !response.ok ||
    payload?.success !== true ||
    typeof url !== "string" ||
    !isAllowedEditorUrl(url, true)
  ) {
    throw new Error(payload?.message || "이미지 업로드에 실패했습니다.");
  }

  return {
    url,
    originalName:
      typeof payload.data?.original_name === "string"
        ? payload.data.original_name
        : file.name,
  };
}
