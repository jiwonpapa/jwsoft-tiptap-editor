import { mountG7FilePicker } from "@/g7/filePicker";

describe("G7 native image picker bridge", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });
  it("falls back without importing or changing a host template", () => {
    vi.stubGlobal("G7Core", {});
    expect(
      mountG7FilePicker(document.createElement("div"), {
        maxSizeMb: 2,
        onFiles: vi.fn(),
      }),
    ).toBeNull();
  });
  it("uses the registered component in selection-only mode and cleans up", async () => {
    const clear = vi.fn(),
      unmount = vi.fn(),
      onFiles = vi.fn();
    let props: Record<string, unknown> = {};
    const component = () => null;
    vi.stubGlobal("G7Core", {
      getComponentMap: () => ({ FileUploader: component }),
    });
    vi.stubGlobal("React", {
      createElement: (type: unknown, value: Record<string, unknown>) => {
        expect(type).toBe(component);
        props = value;
        return value;
      },
    });
    vi.stubGlobal("ReactDOM", {
      createRoot: () => ({ render: vi.fn(), unmount }),
    });
    const dispose = mountG7FilePicker(document.createElement("div"), {
      maxSizeMb: 2,
      onFiles,
    });
    expect(props.autoUpload).toBe(false);
    expect(props.maxSize).toBe(2);
    (props.ref as { current: unknown }).current = { clear };
    const file = new File(["image"], "photo.png", { type: "image/png" });
    (props.onFilesChange as (value: unknown[]) => void)([{ file }]);
    await Promise.resolve();
    expect(onFiles).toHaveBeenCalledWith([file]);
    expect(clear).toHaveBeenCalledOnce();
    dispose?.();
    expect(unmount).toHaveBeenCalledOnce();
  });
});
