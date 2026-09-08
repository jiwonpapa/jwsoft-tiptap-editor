import type { ImageEditorVendor } from "@/features/image-editor/vendorTypes";

const VENDOR_FILE = "image-editor.iife.js";
const PLUGIN_IDENTIFIER = "jwsoft-tiptap-editor";
let pending: Promise<ImageEditorVendor> | null = null;

interface G7AssetConfigWindow extends Window {
  G7Config?: {
    pluginAssets?: Record<string, { js?: unknown }>;
  };
}

function configuredPluginAsset(): string | null {
  const asset = (window as G7AssetConfigWindow).G7Config?.pluginAssets?.[
    PLUGIN_IDENTIFIER
  ]?.js;
  return typeof asset === "string" && asset.length > 0 ? asset : null;
}

function discoverPluginAsset(): string | null {
  const scripts = [...document.scripts].reverse();
  const plugin = scripts.find((script) => {
    try {
      const url = new URL(script.src);
      return (
        url.pathname.endsWith("/dist/js/plugin.iife.js") ||
        url.searchParams.get("file")?.endsWith("/dist/js/plugin.iife.js") ===
          true
      );
    } catch {
      return false;
    }
  });
  return plugin?.src ?? null;
}

function siblingVendorAsset(pluginAsset: string): URL | null {
  const url = new URL(pluginAsset, window.location.href);
  const queriedFile = url.searchParams.get("file");
  if (queriedFile?.endsWith("/plugin.iife.js")) {
    url.searchParams.set(
      "file",
      queriedFile.replace(/plugin\.iife\.js$/u, VENDOR_FILE),
    );
    return url;
  }
  if (!url.pathname.endsWith("/plugin.iife.js")) return null;
  url.pathname = url.pathname.replace(/plugin\.iife\.js$/u, VENDOR_FILE);
  return url;
}

function vendorAssetUrl(): string {
  const override = window.__JWSoftImageEditorAssetBase;
  const url = override
    ? new URL(VENDOR_FILE, override)
    : siblingVendorAsset(
        configuredPluginAsset() ?? discoverPluginAsset() ?? "",
      );
  if (!url)
    throw new Error("jw-editor 이미지 편집 자산 경로를 찾지 못했습니다.");
  if (
    !/^https?:$/.test(url.protocol) ||
    url.origin !== window.location.origin ||
    url.username ||
    url.password
  ) {
    throw new Error("jw-editor 이미지 편집 자산 경로가 안전하지 않습니다.");
  }
  return url.href;
}

function loadScript(): Promise<ImageEditorVendor> {
  let source: string;
  try {
    source = vendorAssetUrl();
  } catch (error) {
    return Promise.reject(error);
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    let settled = false;
    const finish = (
      result: { vendor: ImageEditorVendor } | { error: Error },
    ): void => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      script.removeEventListener("load", handleLoad);
      script.removeEventListener("error", handleError);
      if ("vendor" in result) resolve(result.vendor);
      else {
        script.remove();
        reject(result.error);
      }
    };
    const handleLoad = (): void => {
      const vendor = window.__JWSoftImageEditorVendor;
      finish(
        vendor
          ? { vendor }
          : { error: new Error("이미지 편집 도구 초기화에 실패했습니다.") },
      );
    };
    const handleError = (): void =>
      finish({ error: new Error("이미지 편집 도구를 불러오지 못했습니다.") });
    const timeout = window.setTimeout(
      () =>
        finish({
          error: new Error("이미지 편집 도구 로드 시간이 초과됐습니다."),
        }),
      30_000,
    );
    script.src = source;
    script.async = true;
    script.dataset.jwsoftImageEditor = "vendor";
    script.addEventListener("load", handleLoad);
    script.addEventListener("error", handleError);
    document.head.appendChild(script);
  });
}

export function captureImageEditorAssetBase(
  script: HTMLScriptElement | null,
): void {
  if (!script?.src) return;
  try {
    const url = new URL(script.src);
    if (url.pathname.endsWith("/dist/js/plugin.iife.js")) {
      window.__JWSoftImageEditorAssetBase = new URL(".", url).href;
    }
  } catch {
    // A host may inline the main bundle; discovery remains the fallback.
  }
}

export function loadImageEditorVendor(): Promise<ImageEditorVendor> {
  const ready = window.__JWSoftImageEditorVendor;
  if (ready) return Promise.resolve(ready);
  pending ??= loadScript().catch((error: unknown) => {
    pending = null;
    throw error;
  });
  return pending;
}
