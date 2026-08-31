import { createImageUploadQueue } from "@/editor/imageUploadQueue";
import { uploadEditorImage } from "@/editor/imageUpload";

vi.mock("@/editor/imageUpload", () => ({
  uploadEditorImage: vi.fn(),
  validateEditorImageFile: vi.fn(),
}));

describe("image upload queue lifecycle", () => {
  beforeEach(() => {
    document.body.replaceChildren();
    vi.mocked(uploadEditorImage).mockReset();
    vi.stubGlobal("G7Core", {});
    vi.stubGlobal(
      "URL",
      class extends URL {
        static createObjectURL = vi.fn(() => "blob:preview");
        static revokeObjectURL = vi.fn();
      },
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  function setup() {
    const queue = createImageUploadQueue({
      maxSizeMb: 2,
      locale: "ko",
      onChange: vi.fn(),
    });
    const dialog = document.createElement("dialog");
    dialog.setAttribute("open", "");
    dialog.append(queue.element);
    document.body.append(dialog);
    const input = queue.element.querySelector("input")!;
    Object.defineProperty(input, "files", {
      value: [new File(["PNG"], "qa.png", { type: "image/png" })],
    });
    input.dispatchEvent(new Event("change"));
    return { queue, dialog };
  }

  it("retains a usable fallback and retries only failed uploads", async () => {
    const { queue } = setup();
    queue.mountNative();
    expect(
      queue.element.querySelector<HTMLButtonElement>(".jwsoft-upload-dropzone")
        ?.hidden,
    ).toBe(false);
    vi.mocked(uploadEditorImage).mockRejectedValueOnce(
      new Error("Upload failed"),
    );
    expect(await queue.uploadAll()).toBeNull();
    expect(queue.element.textContent).toContain("Upload failed");
    expect(queue.ready).toBe(false);
    vi.mocked(uploadEditorImage).mockResolvedValueOnce({
      url: "/storage/qa.png",
      originalName: "qa.png",
    });
    expect(await queue.uploadAll()).toEqual([
      { url: "/storage/qa.png", originalName: "qa.png" },
    ]);
    expect(queue.ready).toBe(true);
    await queue.uploadAll();
    expect(uploadEditorImage).toHaveBeenCalledTimes(2);
    queue.destroy();
  });

  it("does not accept a late successful response after cancellation", async () => {
    const { queue } = setup();
    let finish!: (value: { url: string; originalName: string }) => void;
    vi.mocked(uploadEditorImage).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const pending = queue.uploadAll();
    expect(queue.busy).toBe(true);
    queue.cancel();
    finish({ url: "/storage/late.png", originalName: "late.png" });
    expect(await pending).toBeNull();
    expect(queue.ready).toBe(false);
    expect(queue.busy).toBe(false);
    queue.destroy();
  });

  it("does not resurrect removed items or upload a closed dialog", async () => {
    const { queue, dialog } = setup();
    queue.element
      .querySelector<HTMLButtonElement>('[aria-label="선택 해제: qa.png"]')!
      .click();
    expect(queue.count).toBe(0);
    dialog.removeAttribute("open");
    expect(await queue.uploadAll()).toBeNull();
    expect(uploadEditorImage).not.toHaveBeenCalled();
    queue.destroy();
  });
});
