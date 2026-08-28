export interface G7StateApi {
  get?: () => Record<string, unknown>;
  getLocal?: () => Record<string, unknown>;
  setLocal?: (
    updates: Record<string, unknown>,
    options?: Record<string, unknown>,
  ) => void;
}

export interface G7LocaleApi {
  current?: () => string;
  supported?: () => string[];
}

export interface G7ActionDispatcher {
  registerHandler: (
    name: string,
    handler: G7ActionHandler,
    metadata?: Record<string, unknown>,
  ) => void;
}

export interface G7CoreApi {
  state?: G7StateApi;
  locale?: G7LocaleApi;
  getActionDispatcher?: () => G7ActionDispatcher | undefined;
  createLogger?: (scope: string) => G7Logger;
}

export interface G7Logger {
  log: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

export interface G7Action {
  params?: Record<string, unknown>;
  [key: string]: unknown;
}

export type G7ActionHandler = (
  action: G7Action,
  context: unknown,
) => void | Promise<void>;

export type HandlerMap = Record<string, G7ActionHandler>;

export interface InitEditorParams {
  name?: string;
  content?: string | Record<string, string>;
  multilingual?: boolean | string;
  placeholder?: string;
  readOnly?: boolean | string;
  disabled?: boolean | string;
  height?: number | string;
  toolbar?: string;
  imageUpload?: boolean | string;
  imageMaxSizeMb?: number | string;
}

export interface JWSoftTiptapRuntime {
  identifier: string;
  handlers: string[];
  initPlugin: () => void;
  registerHandlers: () => number;
  getInstanceCount: () => number;
}

declare global {
  interface Window {
    G7Core?: G7CoreApi;
    CKEDITOR?: unknown;
    __SirsoftCkeditor5?: unknown;
    JWSoftTiptapEditorBuild?: Readonly<{
      identifier: string;
      stage: string;
      version: string;
      writeEnabled: boolean;
    }>;
    __JWSoftTiptapEditor?: JWSoftTiptapRuntime;
  }
}

export {};
