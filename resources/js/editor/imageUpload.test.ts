import { describe, expect, it, vi } from "vitest";

import {
  uploadEditorImage,
  validateEditorImageFile,
} from "@/editor/imageUpload";

describe("editor image upload", () => {
  it("rejects disallowed MIME and oversized files before network", () => {
    expect(() =>
      validateEditorImageFile(
        new File(["x"], "x.svg", { type: "image/svg+xml" }),
        2,
      ),
    ).toThrow("JPEG");
    expect(() =>
      validateEditorImageFile(
        new File([new Uint8Array(1025 * 1024)], "x.png", { type: "image/png" }),
        1,
      ),
    ).toThrow("1MB");
  });

  it("uploads multipart data and accepts only a policy-safe response URL", async () => {
    let seenInit: RequestInit | undefined;
    const request: typeof fetch = vi.fn(async (_input, init) => {
      seenInit = init;
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            download_url:
              "/api/plugins/jwsoft-tiptap-editor/images/abcdef123456",
            original_name: "safe.png",
          },
        }),
        { status: 201, headers: { "Content-Type": "application/json" } },
      );
    });
    const result = await uploadEditorImage(
      new File(["x"], "safe.png", { type: "image/png" }),
      2,
      request,
    );
    expect(result.url).toContain("abcdef123456");
    expect(request).toHaveBeenCalledOnce();
    expect(seenInit?.body).toBeInstanceOf(FormData);
  });

  it("rejects an unsafe URL even when the server reports success", async () => {
    const request = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            success: true,
            data: { download_url: "javascript:alert(1)" },
          }),
          {
            status: 201,
            headers: { "Content-Type": "application/json" },
          },
        ),
    );
    await expect(
      uploadEditorImage(
        new File(["x"], "safe.png", { type: "image/png" }),
        2,
        request as typeof fetch,
      ),
    ).rejects.toThrow("업로드");
  });
});
