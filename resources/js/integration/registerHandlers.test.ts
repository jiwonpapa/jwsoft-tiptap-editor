import { registerHandlers } from "@/integration/registerHandlers";
import type { HandlerMap } from "@/g7/types";

describe("G7 handler registration", () => {
  it("registers every handler with the plugin namespace", () => {
    const registerHandler = vi.fn();
    const dispatcher = { registerHandler };
    window.G7Core = {
      getActionDispatcher: () => dispatcher,
    };
    const handlers: HandlerMap = {
      initEditor: vi.fn(),
      destroyEditor: vi.fn(),
    };

    expect(registerHandlers(handlers)).toBe(2);
    expect(registerHandler).toHaveBeenCalledWith(
      "jwsoft-tiptap-editor.initEditor",
      handlers.initEditor,
      { category: "plugin", source: "jwsoft-tiptap-editor" },
    );
    expect(registerHandlers(handlers)).toBe(2);
    expect(registerHandler).toHaveBeenCalledTimes(2);
  });
});
