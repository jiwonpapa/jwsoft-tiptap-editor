import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

describe("G7 extension contracts", () => {
  it("provides replace-mode editor and content extensions", () => {
    const editor = JSON.parse(
      fs.readFileSync(
        path.join(root, "resources/extensions/html-editor.json"),
        "utf8",
      ),
    );
    const content = JSON.parse(
      fs.readFileSync(
        path.join(root, "resources/extensions/html-content.json"),
        "utf8",
      ),
    );
    expect(editor).toMatchObject({
      extension_point: "html_editor",
      mode: "replace",
    });
    expect(content).toMatchObject({
      extension_point: "html_content",
      mode: "replace",
    });
    expect(JSON.stringify(editor)).toContain("jwsoft-tiptap-editor.initEditor");
    expect(JSON.stringify(editor)).toContain(
      "jwsoft-tiptap-editor.destroyEditor",
    );
    expect(JSON.stringify(content)).toContain(
      "jwsoft-tiptap-editor.injectContentStyles",
    );
  });

  it("does not declare external runtime scripts", () => {
    const editor = JSON.parse(
      fs.readFileSync(
        path.join(root, "resources/extensions/html-editor.json"),
        "utf8",
      ),
    );
    expect(editor.scripts).toBeUndefined();
  });
});
