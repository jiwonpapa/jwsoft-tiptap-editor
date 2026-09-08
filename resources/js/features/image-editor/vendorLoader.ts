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
