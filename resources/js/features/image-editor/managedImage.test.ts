import { describe, expect, it, vi } from "vitest";
import {
  loadManagedImage,
  managedImageHash,
} from "@/features/image-editor/managedImage";

describe("managed image editor source", () => {
  const path = "/api/plugins/jwsoft-tiptap-editor/images/abcdef123456";

  it("accepts only exact same-origin jw-editor image routes", () => {
    expect(managedImageHash(path)).toBe("abcdef123456");
    expect(managedImageHash(`${location.origin}${path}`)).toBe("abcdef123456");
    expect(managedImageHash(`${path}?download=1`)).toBeNull();
    expect(managedImageHash("https://example.com/image.png")).toBeNull();
    expect(
      managedImageHash("/api/plugins/other/images/abcdef123456"),
    ).toBeNull();
  });

  it("loads JPEG, PNG, or WebP without trusting the URL extension", async () => {
    const request: typeof fetch = vi.fn(
      async () =>
        new Response("png", {
          status: 200,
          headers: { "Content-Type": "image/png" },
        }),
    );
    const source = await loadManagedImage(path, request);
    expect(source.hash).toBe("abcdef123456");
    expect(source.mimeType).toBe("image/png");
    expect(request).toHaveBeenCalledWith(
      path,
      expect.objectContaining({ credentials: "same-origin" }),
    );
  });

  it.each(["image/gif", "image/avif", "image/svg+xml"])(
    "rejects an editing format that cannot preserve the original (%s)",
    async (mimeType) => {
      const request: typeof fetch = vi.fn(
        async () =>
          new Response("image", {
            status: 200,
            headers: { "Content-Type": mimeType },
          }),
      );
      await expect(loadManagedImage(path, request)).rejects.toThrow("GIF·AVIF");
    },
  );
});
