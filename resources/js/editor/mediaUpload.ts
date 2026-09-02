import { editorText } from "@/editor/locale";
import { normalizeMediaUrl } from "@/editor/mediaEmbed";
import { authorizationHeaders } from "@/g7/authorization";

const ENDPOINT = "/api/plugins/jwsoft-tiptap-editor/media/uploads";
const RETRIES = 3;

interface ApiPayload {
  success?: boolean;
  message?: string;
  data?: Record<string, unknown>;
}

interface UploadSession {
  token: string;
  chunkSize: number;
  totalParts: number;
  receivedParts: Set<number>;
}

export interface UploadedEditorMedia {
  url: string;
  originalName: string;
}

export interface MediaUploadOptions {
  maxSizeMb: number;
  locale?: string;
  request?: typeof fetch;
  onProgress?: (uploadedBytes: number, totalBytes: number) => void;
  onPhase?: (phase: "starting" | "uploading" | "processing") => void;
  signal?: AbortSignal;
}

function storageKey(file: File): string {
  return `jwsoft-tiptap-media:${file.name}:${file.size}:${file.lastModified}`;
}

function storedToken(file: File): string | null {
  try {
    const token = window.sessionStorage.getItem(storageKey(file));
    return token && /^[a-f0-9]{32}$/.test(token) ? token : null;
  } catch {
    return null;
  }
}

function rememberToken(file: File, token: string | null): void {
  try {
    if (token) window.sessionStorage.setItem(storageKey(file), token);
    else window.sessionStorage.removeItem(storageKey(file));
  } catch {
    // 사생활 보호 모드처럼 저장소가 차단된 환경에서도 현재 업로드는 계속합니다.
  }
}

async function payload(response: Response): Promise<ApiPayload> {
  try {
    return (await response.json()) as ApiPayload;
  } catch {
    return {};
  }
}

function parseSession(
  data: Record<string, unknown> | undefined,
): UploadSession | null {
  const token = data?.upload_token;
  const chunkSize = Number(data?.chunk_size);
  const totalParts = Number(data?.total_parts);
  const received = data?.received_parts;
  if (
    typeof token !== "string" ||
    !/^[a-f0-9]{32}$/.test(token) ||
    !Number.isInteger(chunkSize) ||
    chunkSize < 1 ||
    !Number.isInteger(totalParts) ||
    totalParts < 1 ||
    !Array.isArray(received)
  ) {
    return null;
  }
  return {
    token,
    chunkSize,
    totalParts,
    receivedParts: new Set(
      received
        .map(Number)
        .filter(
          (part) => Number.isInteger(part) && part >= 0 && part < totalParts,
        ),
    ),
  };
}

async function resumeSession(
  file: File,
  request: typeof fetch,
): Promise<UploadSession | null> {
  const token = storedToken(file);
  if (!token) return null;
  const response = await request(`${ENDPOINT}/${token}`, {
    credentials: "same-origin",
    headers: { Accept: "application/json", ...authorizationHeaders() },
  });
  const body = await payload(response);
  const session =
    response.ok && body.success === true ? parseSession(body.data) : null;
  if (!session) rememberToken(file, null);
  return session;
}

async function beginSession(
  file: File,
  request: typeof fetch,
  locale: string,
): Promise<UploadSession> {
  const response = await request(ENDPOINT, {
    method: "POST",
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...authorizationHeaders(),
    },
    body: JSON.stringify({ original_name: file.name, file_size: file.size }),
  });
  const body = await payload(response);
  const session =
    response.ok && body.success === true ? parseSession(body.data) : null;
  if (!session) {
    throw new Error(
      body.message ||
        editorText(locale, "동영상 업로드를 시작하지 못했습니다."),
    );
  }
  rememberToken(file, session.token);
  return session;
}

const SHA256_CONSTANTS = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
  0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
] as const;

function rotateRight(value: number, bits: number): number {
  return (value >>> bits) | (value << (32 - bits));
}

function sha256Fallback(input: Uint8Array): Uint8Array {
  const paddedLength = Math.ceil((input.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLength);
  padded.set(input);
  padded[input.length] = 0x80;
  const view = new DataView(padded.buffer);
  const bitLength = input.length * 8;
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000));
  view.setUint32(paddedLength - 4, bitLength >>> 0);
  const hash = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c,
    0x1f83d9ab, 0x5be0cd19,
  ]);
  const words = new Uint32Array(64);
  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      words[index] = view.getUint32(offset + index * 4);
    }
    for (let index = 16; index < 64; index += 1) {
      const left = words[index - 15];
      const right = words[index - 2];
      const sigma0 =
        rotateRight(left, 7) ^ rotateRight(left, 18) ^ (left >>> 3);
      const sigma1 =
        rotateRight(right, 17) ^ rotateRight(right, 19) ^ (right >>> 10);
      words[index] =
        (words[index - 16] + sigma0 + words[index - 7] + sigma1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = hash;
    for (let index = 0; index < 64; index += 1) {
      const sum1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const choice = (e & f) ^ (~e & g);
      const temp1 =
        (h + sum1 + choice + SHA256_CONSTANTS[index] + words[index]) >>> 0;
      const sum0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (sum0 + majority) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }
    hash[0] = (hash[0] + a) >>> 0;
    hash[1] = (hash[1] + b) >>> 0;
    hash[2] = (hash[2] + c) >>> 0;
    hash[3] = (hash[3] + d) >>> 0;
    hash[4] = (hash[4] + e) >>> 0;
    hash[5] = (hash[5] + f) >>> 0;
    hash[6] = (hash[6] + g) >>> 0;
    hash[7] = (hash[7] + h) >>> 0;
  }
  const output = new Uint8Array(32);
  const outputView = new DataView(output.buffer);
  hash.forEach((value, index) => outputView.setUint32(index * 4, value));
  return output;
}

async function sha256(blob: Blob): Promise<string> {
  const contents = await blob.arrayBuffer();
  const digest = globalThis.crypto?.subtle
    ? new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", contents))
    : sha256Fallback(new Uint8Array(contents));
  return [...digest]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

async function putPart(
  request: typeof fetch,
  session: UploadSession,
  part: number,
  chunk: Blob,
  checksum: string,
  locale: string,
): Promise<void> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < RETRIES; attempt += 1) {
    try {
      const form = new FormData();
      form.append("chunk", chunk, `part-${part}.bin`);
      form.append("checksum", checksum);
      const response = await request(
        `${ENDPOINT}/${session.token}/parts/${part}`,
        {
          method: "PUT",
          credentials: "same-origin",
          headers: { Accept: "application/json", ...authorizationHeaders() },
          body: form,
        },
      );
      const body = await payload(response);
      if (response.ok && body.success === true) return;
      lastError = new Error(
        body.message ||
          editorText(locale, "동영상 청크 업로드에 실패했습니다."),
      );
      if (response.status < 500) break;
    } catch (error) {
      // DOMException may originate from another realm and fail instanceof Error.
      if (
        error &&
        typeof error === "object" &&
        "name" in error &&
        error.name === "AbortError"
      )
        throw error;
      lastError =
        error instanceof Error
          ? error
          : new Error(editorText(locale, "동영상 청크 업로드에 실패했습니다."));
      if (lastError.name === "AbortError") throw lastError;
    }
  }
  throw (
    lastError ??
    new Error(editorText(locale, "동영상 청크 업로드에 실패했습니다."))
  );
}

export function validateEditorMediaFile(
  file: File,
  maxSizeMb: number,
  locale: string = "ko",
): void {
  const maximum =
    Math.max(1, Math.min(500, Math.floor(maxSizeMb))) * 1024 * 1024;
  if (
    !/\.mp4$/i.test(file.name) ||
    (file.type !== "" && file.type !== "video/mp4")
  ) {
    throw new Error(
      editorText(locale, "MP4 동영상 파일만 업로드할 수 있습니다."),
    );
  }
  if (file.size < 8 || file.size > maximum) {
    throw new Error(
      locale === "en"
        ? `Videos must be ${Math.round(maximum / 1024 / 1024)} MB or smaller.`
        : `동영상은 ${Math.round(maximum / 1024 / 1024)}MB 이하여야 합니다.`,
    );
  }
}

function uploadPartWithProgress(
  url: string,
  form: FormData,
  signal: AbortSignal | undefined,
  onProgress: (fraction: number) => void,
): Promise<Response> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const abort = () => xhr.abort();
    const cleanup = () => signal?.removeEventListener("abort", abort);
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    xhr.open("PUT", url);
    xhr.withCredentials = true;
    xhr.setRequestHeader("Accept", "application/json");
    for (const [key, value] of Object.entries(authorizationHeaders()))
      xhr.setRequestHeader(key, value);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
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
    signal?.addEventListener("abort", abort, { once: true });
    xhr.send(form);
  });
}

export async function uploadEditorMedia(
  file: File,
  options: MediaUploadOptions,
): Promise<UploadedEditorMedia> {
  const locale = options.locale ?? "ko";
  const baseRequest = options.request ?? fetch;
  const request: typeof fetch = (input, init) => {
    if (options.signal?.aborted)
      return Promise.reject(new DOMException("Aborted", "AbortError"));
    return baseRequest(input, {
      ...init,
      ...(options.signal ? { signal: options.signal } : {}),
    });
  };
  validateEditorMediaFile(file, options.maxSizeMb, locale);
  options.onPhase?.("starting");
  let session = await resumeSession(file, request);
  session ??= await beginSession(file, request, locale);
  if (session.totalParts !== Math.ceil(file.size / session.chunkSize)) {
    rememberToken(file, null);
    throw new Error(
      editorText(locale, "동영상 업로드 세션 정보가 올바르지 않습니다."),
    );
  }

  let completed = [...session.receivedParts].reduce(
    (bytes, part) =>
      bytes + Math.min(session.chunkSize, file.size - part * session.chunkSize),
    0,
  );
  options.onPhase?.("uploading");
  options.onProgress?.(completed, file.size);
  for (let part = 0; part < session.totalParts; part += 1) {
    if (session.receivedParts.has(part)) continue;
    const chunk = file.slice(
      part * session.chunkSize,
      Math.min(file.size, (part + 1) * session.chunkSize),
    );
    const partRequest: typeof fetch = (input, init) => {
      if (
        options.onProgress &&
        !options.request &&
        init?.body instanceof FormData
      ) {
        return uploadPartWithProgress(
          String(input),
          init.body,
          options.signal,
          (fraction) => {
            options.onProgress?.(
              completed + Math.round(chunk.size * fraction),
              file.size,
            );
          },
        );
      }
      return request(input, init);
    };
    await putPart(
      partRequest,
      session,
      part,
      chunk,
      await sha256(chunk),
      locale,
    );
    completed += chunk.size;
    options.onProgress?.(completed, file.size);
  }

  options.onPhase?.("processing");
  const response = await request(`${ENDPOINT}/${session.token}/complete`, {
    method: "POST",
    credentials: "same-origin",
    headers: { Accept: "application/json", ...authorizationHeaders() },
  });
  const body = await payload(response);
  const url = body.data?.download_url;
  const media =
    typeof url === "string"
      ? normalizeMediaUrl(url, { youtube: false, vimeo: false, mp4: true })
      : null;
  if (
    !response.ok ||
    body.success !== true ||
    !media ||
    media.provider !== "mp4"
  ) {
    throw new Error(
      body.message || editorText(locale, "동영상 업로드에 실패했습니다."),
    );
  }
  rememberToken(file, null);

  return { url: media.sourceUrl, originalName: file.name };
}
