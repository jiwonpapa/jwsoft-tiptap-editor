import { createEditor } from "@/editor/createEditor";
import { startImageUpload } from "@/editor/imageDropUpload";
import type { Editor } from "@tiptap/core";

let editor: Editor;
let status: HTMLElement;
const file = new File(["fixture"], "first.png", { type: "image/png" });
const response = (name = "first.png") =>
  new Response(
    JSON.stringify({
      success: true,
      data: { download_url: `/${name}`, original_name: name },
    }),
  );
beforeEach(() => {
  document.body.innerHTML = '<div id="editor"></div><div id="status"></div>';
  status = document.getElementById("status")!;
  editor = createEditor({
    element: document.getElementById("editor")!,
    content: "<p>abcdef</p>",
    editable: true,
    placeholder: "",
    onUpdate: () => {},
  });
});
afterEach(() => {
  editor.destroy();
  vi.unstubAllGlobals();
});
const start = (files = [file]) =>
  startImageUpload({
    editor,
    files,
    position: 4,
    maxSizeMb: 2,
    locale: "ko",
    status,
  });

it("maps a pending drop through concurrent edits instead of splitting newly typed text", async () => {
  let complete!: (value: Response) => void;
  vi.stubGlobal(
    "fetch",
    vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          complete = resolve;
        }),
    ),
  );
  start();
  editor.commands.insertContentAt(1, "PREFIX");
  complete(response());
  await vi.waitFor(() => expect(status.dataset.tone).toBe("success"));
  expect(editor.getHTML()).toContain("<p>PREFIXabc</p><figure");
  expect(editor.getHTML()).toContain("<p>def</p>");
});

it("preserves the selected drop order for several files", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce(response())
      .mockResolvedValueOnce(response("second.png")),
  );
  start([file, new File(["two"], "second.png", { type: "image/png" })]);
  await vi.waitFor(() => expect(status.dataset.tone).toBe("success"));
  expect(
    [...editor.view.dom.querySelectorAll("img")].map((img) =>
      img.getAttribute("src"),
    ),
  ).toEqual(["/first.png", "/second.png"]);
  expect(status.textContent).toContain("2개");
});

it.each(["destroy", "delete"])(
  "cancels upload insertion when the target is %s",
  async (operation) => {
    let complete!: (value: Response) => void;
    let signal: AbortSignal | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init: RequestInit) => {
        signal = init.signal ?? undefined;
        return new Promise<Response>((resolve) => {
          complete = resolve;
        });
      }),
    );
    start();
    if (operation === "destroy") editor.destroy();
    else editor.commands.clearContent();
    expect(signal?.aborted).toBe(true);
    complete(response());
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(status.dataset.tone).not.toBe("success");
    if (!editor.isDestroyed) expect(editor.getHTML()).not.toContain("<img");
  },
);

it("reports failed HTTP uploads without claiming insertion", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response("{}", { status: 403 })),
  );
  start();
  await vi.waitFor(() => expect(status.dataset.tone).toBe("warning"));
  expect(editor.getHTML()).toBe("<p>abcdef</p>");
});
