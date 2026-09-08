import { describe, expect, it } from "vitest";
import {
  createEditedFile,
  imageEditorOutput,
} from "@/features/image-editor/editedFile";
import type { ManagedImageSource } from "@/features/image-editor/managedImage";

function source(mimeType: ManagedImageSource["mimeType"]): ManagedImageSource {
  return {
    blob: new Blob(["source"], { type: mimeType }),
    hash: "abcdef123456",
    mimeType,
  };
}

describe("edited image file", () => {
  it.each([
    ["image/jpeg", "jpg", "jpeg"],
    ["image/png", "png", "png"],
    ["image/webp", "webp", "webp"],
  ] as const)(
    "preserves supported output type %s",
    (mimeType, extension, editorExtension) => {
      expect(imageEditorOutput(source(mimeType))).toMatchObject({
        extension,
        editorExtension,
      });
    },
  );

  it("creates a named new file from strict image data", async () => {
    const edited = await createEditedFile(
      { imageBase64: "data:image/png;base64,eA==" },
      source("image/png"),
      1_234,
    );
    expect(edited.name).toBe("abcdef123456-edited-1234.png");
    expect(edited.type).toBe("image/png");
    expect(edited.size).toBe(1);
  });

  it("rejects a mismatched or missing editor output", async () => {
    await expect(
      createEditedFile(
        { imageBase64: "data:image/jpeg;base64,eA==" },
        source("image/png"),
      ),
    ).rejects.toThrow("형식");
    await expect(createEditedFile({}, source("image/png"))).rejects.toThrow(
      "결과",
    );
  });
});
