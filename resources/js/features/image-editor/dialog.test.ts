import { NodeSelection } from "@tiptap/pm/state";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEditor } from "@/editor/createEditor";
import { createImageEditorDialog } from "@/features/image-editor/dialog";
import type {
  ImageEditorInstance,
  ImageEditorVendor,
} from "@/features/image-editor/vendorTypes";

const stubs = vi.hoisted(() => ({
  loadManagedImage: vi.fn(),
  loadVendor: vi.fn(),
  uploadImage: vi.fn(),
  terminate: vi.fn(),
  hideSpinner: vi.fn(),
}));

vi.mock("@/features/image-editor/managedImage", () => ({
  loadManagedImage: stubs.loadManagedImage,
}));
vi.mock("@/features/image-editor/vendorLoader", () => ({
  loadImageEditorVendor: stubs.loadVendor,
}));
vi.mock("@/editor/imageUpload", () => ({
  uploadEditorImage: stubs.uploadImage,
}));

class FakeImageEditor implements ImageEditorInstance {
  constructor(
    private readonly container: HTMLElement,
    _config: Record<string, unknown>,
  ) {}

  render(): void {
    this.container.append(document.createElement("canvas"));
  }

  terminate(): void {
    stubs.terminate();
  }

  getCurrentImgData() {
    return {
      imageData: {
        imageBase64: `data:image/png;base64,${window.btoa("edited")}`,
      },
      hideLoadingSpinner: stubs.hideSpinner,
    };
  }
}

const vendor = {
  Editor: FakeImageEditor,
  TABS: {
    ADJUST: "Adjust",
    FINETUNE: "Finetune",
    FILTERS: "Filters",
    RESIZE: "Resize",
  },
  TOOLS: { CROP: "Crop" },
} as unknown as ImageEditorVendor;

function fixture() {
  const mount = document.createElement("div");
  const trigger = document.createElement("button");
  document.body.append(mount, trigger);
  const editor = createEditor({
    element: mount,
    content: "<p></p>",
    placeholder: "",
    editable: true,
    onUpdate: vi.fn(),
  });
  editor.commands.insertContent({
    type: "image",
    attrs: {
      src: "/api/plugins/jwsoft-tiptap-editor/images/abcdef123456",
      alt: "대체 설명",
      title: "이미지 제목",
      caption: "캡션",
      jwClassTokens: "jw-image jw-image-align-right jw-image-size-75",
    },
  });
  let position = -1;
  editor.state.doc.descendants((node, offset) => {
    if (node.type.name === "image") position = offset;
  });
  editor.view.dispatch(
    editor.state.tr.setSelection(
      NodeSelection.create(editor.state.doc, position),
    ),
  );
  const dialog = createImageEditorDialog({
    editor,
    trigger,
    maxSizeMb: 10,
    locale: "ko",
  });
  document.body.append(dialog.element);
  return { dialog, editor, trigger };
}

describe("image editor dialog", () => {
  beforeEach(() => {
    for (const stub of Object.values(stubs)) stub.mockReset();
    stubs.loadManagedImage.mockResolvedValue({
      blob: new Blob(["image"], { type: "image/png" }),
      hash: "abcdef123456",
      mimeType: "image/png",
    });
    stubs.loadVendor.mockResolvedValue(vendor);
    stubs.uploadImage.mockResolvedValue({
      url: "/api/plugins/jwsoft-tiptap-editor/images/fedcba654321",
      originalName: "edited.png",
    });
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:http://localhost/editor"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => document.body.replaceChildren());

  it("uploads a new file and changes only the selected image source", async () => {
    const { dialog, editor, trigger } = fixture();
    trigger.click();
    const save = dialog.element.querySelector<HTMLButtonElement>(
      ".jwsoft-tiptap-dialog-primary",
    );
    await vi.waitFor(() => expect(save?.disabled).toBe(false));
    save?.click();
    await vi.waitFor(() => expect(dialog.element.open).toBe(false));

    expect(stubs.uploadImage).toHaveBeenCalledWith(
      expect.objectContaining({
        name: expect.stringMatching(/-edited-\d+\.png$/),
      }),
      10,
      fetch,
      "ko",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(editor.getHTML()).toContain(
      'src="/api/plugins/jwsoft-tiptap-editor/images/fedcba654321"',
    );
    expect(editor.getHTML()).toContain('alt="대체 설명"');
    expect(editor.getHTML()).toContain('title="이미지 제목"');
    expect(editor.getHTML()).toContain("<figcaption>캡션</figcaption>");
    expect(editor.getHTML()).toContain("jw-image-align-right jw-image-size-75");
    expect(stubs.hideSpinner).toHaveBeenCalledOnce();
    editor.destroy();
  });

  it("keeps the original source and open modal when upload fails", async () => {
    stubs.uploadImage.mockRejectedValue(new Error("업로드 실패"));
    const { dialog, editor, trigger } = fixture();
    trigger.click();
    const save = dialog.element.querySelector<HTMLButtonElement>(
      ".jwsoft-tiptap-dialog-primary",
    );
    await vi.waitFor(() => expect(save?.disabled).toBe(false));
    save?.click();
    await vi.waitFor(() =>
      expect(dialog.element.querySelector("[role=alert]")?.textContent).toBe(
        "업로드 실패",
      ),
    );

    expect(dialog.element.open).toBe(true);
    expect(editor.getHTML()).toContain(
      'src="/api/plugins/jwsoft-tiptap-editor/images/abcdef123456"',
    );
    dialog.element
      .querySelector<HTMLButtonElement>(".jwsoft-image-editor-actions button")
      ?.click();
    expect(dialog.element.open).toBe(false);
    expect(stubs.terminate).toHaveBeenCalled();
    editor.destroy();
  });
});
