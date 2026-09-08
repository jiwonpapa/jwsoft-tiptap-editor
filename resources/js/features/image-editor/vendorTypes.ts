export interface ImageEditorData {
  imageBase64?: string;
  imageCanvas?: HTMLCanvasElement;
  mimeType?: string;
}

export interface ImageEditorExport {
  imageData?: ImageEditorData;
  hideLoadingSpinner?: () => void;
}

export interface ImageEditorInstance {
  render: () => void;
  terminate: () => void;
  getCurrentImgData: (
    file: { name: string; extension: string; quality: number },
    pixelRatio?: number,
    keepLoadingSpinnerShown?: boolean,
  ) => ImageEditorExport;
}

export interface ImageEditorConstructor {
  new (
    container: HTMLElement,
    config: Record<string, unknown>,
  ): ImageEditorInstance;
  TABS: Readonly<Record<string, string>>;
  TOOLS: Readonly<Record<string, string>>;
}

export interface ImageEditorVendor {
  Editor: ImageEditorConstructor;
  TABS: Readonly<Record<string, string>>;
  TOOLS: Readonly<Record<string, string>>;
}

declare global {
  interface Window {
    __JWSoftImageEditorAssetBase?: string;
    __JWSoftImageEditorVendor?: ImageEditorVendor;
  }
}
