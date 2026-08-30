interface PendingFile {
  file: File;
}
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
    createRoot: (container: HTMLElement) => {
      render: (element: unknown) => void;
      unmount: () => void;
    };
  };
  G7Core?: { getComponentMap?: () => Record<string, unknown> };
}

/** Reuse G7's public React/component registry, without importing host files or
 * bundling another React runtime. Selection-only mode retains our upload API,
 * cancellation and ownership lifecycle rather than the generic attachment API. */
export function mountG7FilePicker(
  container: HTMLElement,
  options: {
    maxSizeMb: number;
    onFiles: (files: File[]) => void;
  },
): (() => void) | null {
  const host = window as unknown as ReactHost;
  const component = host.G7Core?.getComponentMap?.().FileUploader;
  if (!component || !host.React?.createElement || !host.ReactDOM?.createRoot)
    return null;
  const ref: { current: PickerRef | null } = { current: null };
  const root = host.ReactDOM.createRoot(container);
  let mounted = true;
  root.render(
    host.React.createElement(component, {
      ref,
      autoUpload: false,
      maxFiles: 10,
      maxSize: options.maxSizeMb,
      accept: ".jpg,.jpeg,.png,.gif,.webp,.avif",
      imageCompression: {
        maxSizeMB: options.maxSizeMb,
        maxWidthOrHeight: 16384,
      },
      onFilesChange: (pending: PendingFile[]) => {
        if (!mounted || pending.length === 0) return;
        options.onFiles(pending.map((item) => item.file));
        queueMicrotask(() => {
          if (mounted) ref.current?.clear();
        });
      },
    }),
  );
  container.dataset.uploader = "g7-native";
  return () => {
    mounted = false;
    root.unmount();
  };
}
