import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ImageEditorVendor } from "@/features/image-editor/vendorTypes";

function clearVendorState(): void {
  delete window.__JWSoftImageEditorAssetBase;
  delete window.__JWSoftImageEditorVendor;
  document
    .querySelectorAll("script[data-jwsoft-image-editor='vendor']")
    .forEach((script) => script.remove());
}

describe("image editor vendor loader", () => {
  beforeEach(() => {
    vi.resetModules();
    clearVendorState();
  });

  afterEach(clearVendorState);

  it("loads the bundled vendor only from the current origin", async () => {
    window.__JWSoftImageEditorAssetBase = `${window.location.origin}/dist/js/`;
    const { loadImageEditorVendor } =
      await import("@/features/image-editor/vendorLoader");
    const loading = loadImageEditorVendor();
    const script = document.querySelector<HTMLScriptElement>(
      "script[data-jwsoft-image-editor='vendor']",
    );
    expect(script?.src).toBe(
      `${window.location.origin}/dist/js/image-editor.iife.js`,
    );
    const vendor = {} as ImageEditorVendor;
    window.__JWSoftImageEditorVendor = vendor;
    script?.dispatchEvent(new Event("load"));
    await expect(loading).resolves.toBe(vendor);
  });

  it("rejects a CDN asset base before inserting a script", async () => {
    window.__JWSoftImageEditorAssetBase =
      "https://cdn.example.com/jw-editor/dist/js/";
    const { loadImageEditorVendor } =
      await import("@/features/image-editor/vendorLoader");
    await expect(loadImageEditorVendor()).rejects.toThrow(
      "자산 경로가 안전하지 않습니다",
    );
    expect(
      document.querySelector("script[data-jwsoft-image-editor='vendor']"),
    ).toBeNull();
  });
});
