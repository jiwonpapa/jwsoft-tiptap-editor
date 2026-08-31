import { filesFromG7Selection, mountG7FilePicker } from "@/g7/filePicker";

describe("G7 native image picker bridge", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });
  it("accepts public change events, admin arrays and ignores empty or malformed notifications", () => {
    const file = new File(["image"], "photo.png", { type: "image/png" });
    for (const value of [
      [{ file }],
      { target: { files: [{ file }] } },
      { target: { value: [{ file }] } },
      [file],
    ]) {
      expect(filesFromG7Selection(value)).toEqual([file]);
    }
    for (const value of [
      undefined,
      null,
      {},
      [],
      { target: { files: [] } },
      [{ file: "not a file" }],
      { target: { value: {} } },
    ]) {
      expect(filesFromG7Selection(value)).toEqual([]);
    }
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
      onFiles = vi.fn(),
      onReady = vi.fn();
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
    const container = document.createElement("div");
    const dispose = mountG7FilePicker(container, {
      maxSizeMb: 2,
      onFiles,
      onReady,
    });
    expect(onReady).toHaveBeenLastCalledWith(false);
    container.innerHTML = '<input type="file">';
    await Promise.resolve();
    expect(onReady).toHaveBeenLastCalledWith(true);
    container.replaceChildren();
    await Promise.resolve();
    expect(onReady).toHaveBeenLastCalledWith(false);
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
    (props.onFilesChange as (value: unknown) => void)({
      target: { files: [{ file }] },
    });
    expect(onFiles).toHaveBeenCalledOnce();
  });
});
