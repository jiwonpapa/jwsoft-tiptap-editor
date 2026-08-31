import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  uploadEditorMedia,
  validateEditorMediaFile,
} from "@/editor/mediaUpload";

const token = "0123456789abcdef0123456789abcdef";
const mp4 = new Uint8Array([
  0, 0, 0, 24, 102, 116, 121, 112, 105, 115, 111, 109, 0, 0, 0, 0, 105, 115,
  111, 109, 109, 112, 52, 49, 0, 0, 0, 8, 109, 100, 97, 116,
]);

function file(): File {
  return new File([mp4], "sample.mp4", {
    type: "video/mp4",
    lastModified: 1234,
  });
}

function response(data: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("MP4 chunk upload", () => {
  beforeEach(() => window.sessionStorage.clear());

  it("retries a failed chunk and completes the upload", async () => {
    let putAttempts = 0;
    const request = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith("/media/uploads") && init?.method === "POST") {
          return response(
            {
              success: true,
              data: {
                upload_token: token,
                chunk_size: mp4.byteLength,
                total_parts: 1,
                received_parts: [],
              },
            },
            201,
          );
        }
        if (url.endsWith("/parts/0")) {
          putAttempts += 1;
          expect((init?.body as FormData).get("checksum")).toBe(
            "d7e840ae173b0f836da3d1ceb035606e1eb7803fe87ad395a63556eb87c89724",
          );
          return putAttempts === 1
            ? response({ success: false, message: "retry" }, 500)
            : response({ success: true, data: {} });
        }
        if (url.endsWith("/complete")) {
          return response(
            {
              success: true,
              data: {
                download_url:
                  "/api/plugins/jwsoft-tiptap-editor/media/abcdef123456",
              },
            },
            201,
          );
        }
        throw new Error(`unexpected request: ${url}`);
      },
    );
    const progress: string[] = [];

    const uploaded = await uploadEditorMedia(file(), {
      maxSizeMb: 200,
      request: request as typeof fetch,
      onProgress: (completed, total) => progress.push(`${completed}/${total}`),
    });

    expect(uploaded.url).toBe(
      "/api/plugins/jwsoft-tiptap-editor/media/abcdef123456",
    );
    expect(putAttempts).toBe(2);
    expect(progress).toEqual([
      `0/${mp4.byteLength}`,
      `${mp4.byteLength}/${mp4.byteLength}`,
    ]);
    expect(uploaded.originalName).toBe("sample.mp4");
    expect(window.sessionStorage.length).toBe(0);
  });

  it("resumes a remembered session without re-uploading received chunks", async () => {
    const source = file();
    window.sessionStorage.setItem(
      `jwsoft-tiptap-media:${source.name}:${source.size}:${source.lastModified}`,
      token,
    );
    const request = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith(`/media/uploads/${token}`) && !init?.method) {
          return response({
            success: true,
            data: {
              upload_token: token,
              chunk_size: mp4.byteLength,
              total_parts: 1,
              received_parts: [0],
            },
          });
        }
        if (url.endsWith("/complete")) {
          return response(
            {
              success: true,
              data: {
                download_url:
                  "/api/plugins/jwsoft-tiptap-editor/media/abcdef123456",
              },
            },
            201,
          );
        }
        throw new Error(`unexpected request: ${url}`);
      },
    );

    await uploadEditorMedia(source, {
      maxSizeMb: 200,
      request: request as typeof fetch,
    });

    expect(request).toHaveBeenCalledTimes(2);
    expect(
      request.mock.calls.some(([url]) => String(url).includes("/parts/")),
    ).toBe(false);
  });

  it("rejects non-MP4 and oversized files before network access", () => {
    expect(() =>
      validateEditorMediaFile(
        new File(["x"], "movie.mov", { type: "video/quicktime" }),
        200,
      ),
    ).toThrow("MP4");
    expect(() =>
      validateEditorMediaFile(
        new File([new Uint8Array(1024 * 1024 + 1)], "movie.mp4", {
          type: "video/mp4",
        }),
        1,
      ),
    ).toThrow("1MB");
  });

  it("counts resumed short final chunks in bytes and reports processing separately", async () => {
    const source = file();
    window.sessionStorage.setItem(
      `jwsoft-tiptap-media:${source.name}:${source.size}:${source.lastModified}`,
      token,
    );
    const progress: number[] = [];
    const phases: string[] = [];
    const request = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith(`/uploads/${token}`))
        return response({
          success: true,
          data: {
            upload_token: token,
            chunk_size: 24,
            total_parts: 2,
            received_parts: [1],
          },
        });
      if (url.endsWith("/parts/0")) return response({ success: true });
      if (url.endsWith("/complete"))
        return response({
          success: true,
          data: {
            download_url:
              "/api/plugins/jwsoft-tiptap-editor/media/abcdef123456",
          },
        });
      throw new Error(url);
    });
    await uploadEditorMedia(source, {
      maxSizeMb: 200,
      request,
      onProgress: (bytes) => progress.push(bytes),
      onPhase: (phase) => phases.push(phase),
    });
    expect(progress).toEqual([8, 32]);
    expect(phases).toEqual(["starting", "uploading", "processing"]);
    expect(
      request.mock.calls.some(([url]) => String(url).endsWith("/parts/1")),
    ).toBe(false);
  });

  it("does not retry or complete an aborted upload", async () => {
    const request = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith("/uploads"))
        return response({
          success: true,
          data: {
            upload_token: token,
            chunk_size: 32,
            total_parts: 1,
            received_parts: [],
          },
        });
      throw new DOMException("Aborted", "AbortError");
    });
    await expect(
      uploadEditorMedia(file(), { maxSizeMb: 200, request }),
    ).rejects.toThrow("Aborted");
    expect(request).toHaveBeenCalledTimes(2);
    expect(window.sessionStorage.length).toBe(1);
  });
});
