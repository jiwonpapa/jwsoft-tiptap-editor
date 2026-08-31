interface PickerRef {
  clear: () => void;
}
interface ReactHost {
  React?: {
    createElement: (
      component: unknown,
      props: Record<string, unknown>,
    ) => unknown;
  };
  ReactDOM?: {
    createRoot: (
      container: HTMLElement,
      options?: Record<string, unknown>,
    ) => {
      render: (element: unknown) => void;
      unmount: () => void;
    };
  };
  G7Core?: { getComponentMap?: () => Record<string, unknown> };
}

/** Basic sends a change event; Admin Basic sends PendingFile[]. */
export function filesFromG7Selection(value: unknown): File[] {
  const target =
    value && typeof value === "object" && "target" in value
      ? value.target
      : null;
  const candidate =
    target && typeof target === "object"
      ? "files" in target
        ? target.files
        : "value" in target
          ? target.value
          : null
      : value;
  const entries = Array.isArray(candidate)
    ? candidate
    : candidate instanceof FileList
      ? Array.from(candidate)
      : [];
  return entries.flatMap((entry: unknown) => {
    const file =
      entry instanceof File
        ? entry
        : entry && typeof entry === "object" && "file" in entry
          ? entry.file
          : null;
    return file instanceof File ? [file] : [];
  });
}

/** Reuse G7's public React/component registry, without importing host files or
 * bundling another React runtime. Selection-only mode retains our upload API,
 * cancellation and ownership lifecycle rather than the generic attachment API. */
export function mountG7FilePicker(
  container: HTMLElement,
  options: {
    maxSizeMb: number;
    onFiles: (files: File[]) => void;
    onReady?: (ready: boolean) => void;
    onError?: (message: string) => void;
  },
): (() => void) | null {
  const host = window as unknown as ReactHost;
  const component = host.G7Core?.getComponentMap?.().FileUploader;
  if (!component || !host.React?.createElement || !host.ReactDOM?.createRoot)
    return null;
  const ref: { current: PickerRef | null } = { current: null };
  let mounted = true;
  const updateReady = () => {
    if (mounted)
      options.onReady?.(Boolean(container.querySelector('input[type="file"]')));
  };
  const observer = new MutationObserver(updateReady);
  observer.observe(container, { childList: true, subtree: true });
  let root: { render: (element: unknown) => void; unmount: () => void } | null =
    null;
  try {
    root = host.ReactDOM.createRoot(container, {
      onUncaughtError: () => {
        if (mounted) options.onReady?.(false);
      },
    });
    root.render(
      host.React.createElement(component, {
        ref,
        autoUpload: false,
        maxFiles: 10,
        maxSize: options.maxSizeMb,
        accept: ".jpg,.jpeg,.png,.gif,.webp,.avif",
        onUploadError: (message: unknown) => {
          if (mounted && typeof message === "string")
            options.onError?.(message);
        },
        onFilesChange: (pending: unknown) => {
          if (!mounted) return;
          const files = filesFromG7Selection(pending);
          if (!files.length) return;
          options.onFiles(files);
          queueMicrotask(() => {
            if (mounted) ref.current?.clear();
          });
        },
      }),
    );
  } catch {
    mounted = false;
    observer.disconnect();
    root?.unmount();
    options.onReady?.(false);
    return null;
  }
  container.dataset.uploader = "g7-native";
  updateReady();
  return () => {
    mounted = false;
    observer.disconnect();
    root?.unmount();
  };
}
