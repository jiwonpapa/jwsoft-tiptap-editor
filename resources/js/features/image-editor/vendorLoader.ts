import type { ImageEditorVendor } from "@/features/image-editor/vendorTypes";

const VENDOR_FILE = "image-editor.iife.js";
let pending: Promise<ImageEditorVendor> | null = null;

function discoverAssetBase(): string | null {
  const scripts = [...document.scripts].reverse();
  const plugin = scripts.find((script) => {
    try {
      return new URL(script.src).pathname.endsWith("/dist/js/plugin.iife.js");
    } catch {
      return false;
    }
  });
  return plugin?.src ? new URL(".", plugin.src).href : null;
}

function vendorAssetUrl(): string {
  const base = window.__JWSoftImageEditorAssetBase ?? discoverAssetBase();
  if (!base)
    throw new Error("jw-editor 이미지 편집 자산 경로를 찾지 못했습니다.");
  const url = new URL(VENDOR_FILE, base);
  if (!/^https?:$/.test(url.protocol)) {
    throw new Error("jw-editor 이미지 편집 자산 경로가 안전하지 않습니다.");
  }
  return url.href;
}

function loadScript(): Promise<ImageEditorVendor> {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    const timeout = window.setTimeout(
      () => reject(new Error("이미지 편집 도구 로드 시간이 초과됐습니다.")),
      30_000,
    );
    const cleanup = () => window.clearTimeout(timeout);
    script.src = vendorAssetUrl();
    script.async = true;
    script.dataset.jwsoftImageEditor = "vendor";
    script.addEventListener("load", () => {
      cleanup();
      const vendor = window.__JWSoftImageEditorVendor;
      if (vendor) resolve(vendor);
      else reject(new Error("이미지 편집 도구 초기화에 실패했습니다."));
    });
    script.addEventListener("error", () => {
      cleanup();
      script.remove();
      reject(new Error("이미지 편집 도구를 불러오지 못했습니다."));
    });
    document.head.appendChild(script);
  });
}

export function captureImageEditorAssetBase(
  script: HTMLScriptElement | null,
): void {
  if (!script?.src) return;
  try {
    window.__JWSoftImageEditorAssetBase = new URL(".", script.src).href;
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
