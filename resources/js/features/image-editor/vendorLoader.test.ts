import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ImageEditorVendor } from "@/features/image-editor/vendorTypes";

function clearVendorState(): void {
  delete window.__JWSoftImageEditorAssetBase;
  delete window.__JWSoftImageEditorVendor;
  delete (window as typeof window & { G7Config?: unknown }).G7Config;
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

  it("resolves the lazy bundle from G7 plugin assets while the merged bundle runs", async () => {
    const merged = document.createElement("script");
    merged.src = `${window.location.origin}/api/plugins/bundle.js?v=17`;
    (
      window as typeof window & {
        G7Config?: { pluginAssets: Record<string, { js: string }> };
      }
    ).G7Config = {
      pluginAssets: {
        "jwsoft-tiptap-editor": {
          js: "/api/plugins/assets/jwsoft-tiptap-editor/dist/js/plugin.iife.js?v=17",
        },
      },
    };
    const { captureImageEditorAssetBase, loadImageEditorVendor } =
      await import("@/features/image-editor/vendorLoader");
    captureImageEditorAssetBase(merged);
    expect(window.__JWSoftImageEditorAssetBase).toBeUndefined();

    const loading = loadImageEditorVendor();
    const script = document.querySelector<HTMLScriptElement>(
      "script[data-jwsoft-image-editor='vendor']",
    );
    expect(script?.src).toBe(
      `${window.location.origin}/api/plugins/assets/jwsoft-tiptap-editor/dist/js/image-editor.iife.js?v=17`,
    );
    const vendor = {} as ImageEditorVendor;
    window.__JWSoftImageEditorVendor = vendor;
    script?.dispatchEvent(new Event("load"));
    await expect(loading).resolves.toBe(vendor);
  });

  it("preserves G7 extensionless asset mode and cache version", async () => {
    (
      window as typeof window & {
        G7Config?: { pluginAssets: Record<string, { js: string }> };
      }
    ).G7Config = {
      pluginAssets: {
        "jwsoft-tiptap-editor": {
          js: "/api/plugins/assets/jwsoft-tiptap-editor?file=dist%2Fjs%2Fplugin.iife.js&v=23",
        },
      },
    };
    const { loadImageEditorVendor } =
      await import("@/features/image-editor/vendorLoader");
    const loading = loadImageEditorVendor();
    const script = document.querySelector<HTMLScriptElement>(
      "script[data-jwsoft-image-editor='vendor']",
    );
    expect(script?.src).toBe(
      `${window.location.origin}/api/plugins/assets/jwsoft-tiptap-editor?file=dist%2Fjs%2Fimage-editor.iife.js&v=23`,
    );
    const vendor = {} as ImageEditorVendor;
    window.__JWSoftImageEditorVendor = vendor;
    script?.dispatchEvent(new Event("load"));
    await expect(loading).resolves.toBe(vendor);
  });
});
