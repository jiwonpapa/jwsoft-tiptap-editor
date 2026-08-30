import { EDITOR_POLICY } from "@/generated/editorPolicy";
import { isAllowedEditorUrl } from "@/policy/runtimePolicy";
import { editorText } from "@/editor/locale";

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

export function validateEditorImageFile(
  file: File,
  maxSizeMb: number,
  locale: string = "ko",
): void {
  const allowed = EDITOR_POLICY.media.allowedMimeTypes as readonly string[];
  if (!allowed.includes(file.type)) {
    throw new Error(
      editorText(
        locale,
        "JPEG, PNG, GIF, WebP, AVIF 이미지만 업로드할 수 있습니다.",
      ),
    );
  }
  const configured =
    Math.max(1, Math.min(10, Math.floor(maxSizeMb))) * 1024 * 1024;
  const maximum = Math.min(configured, EDITOR_POLICY.limits.maxImageBytes);
  if (file.size < 1 || file.size > maximum) {
    throw new Error(
      locale === "en"
        ? `Images must be ${Math.round(maximum / 1024 / 1024)} MB or smaller.`
        : `이미지는 ${Math.round(maximum / 1024 / 1024)}MB 이하여야 합니다.`,
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
  locale: string = "ko",
  options: {
    signal?: AbortSignal;
    onProgress?: (percent: number) => void;
  } = {},
): Promise<UploadedEditorImage> {
  validateEditorImageFile(file, maxSizeMb, locale);
  const form = new FormData();
  form.append("upload", file);
  const response = options.onProgress
    ? await uploadWithProgress(form, options)
    : await request(ENDPOINT, {
        method: "POST",
        credentials: "same-origin",
        headers: { Accept: "application/json", ...authorizationHeaders() },
        body: form,
        ...(options.signal ? { signal: options.signal } : {}),
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
    throw new Error(
      payload?.message || editorText(locale, "이미지 업로드에 실패했습니다."),
    );
  }

  return {
    url,
    originalName:
      typeof payload.data?.original_name === "string"
        ? payload.data.original_name
        : file.name,
  };
}

function uploadWithProgress(
  form: FormData,
  options: {
    signal?: AbortSignal;
    onProgress?: (percent: number) => void;
  },
): Promise<Response> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const abort = () => xhr.abort();
    const cleanup = () => options.signal?.removeEventListener("abort", abort);
    if (options.signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    xhr.open("POST", ENDPOINT);
    xhr.withCredentials = true;
    xhr.setRequestHeader("Accept", "application/json");
    for (const [name, value] of Object.entries(authorizationHeaders()))
      xhr.setRequestHeader(name, value);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable)
        options.onProgress?.(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      cleanup();
      resolve(new Response(xhr.responseText, { status: xhr.status }));
    };
    xhr.onerror = () => {
      cleanup();
      reject(new Error("Network error"));
    };
    xhr.onabort = () => {
      cleanup();
      reject(new DOMException("Aborted", "AbortError"));
    };
    options.signal?.addEventListener("abort", abort, { once: true });
    xhr.send(form);
  });
}
