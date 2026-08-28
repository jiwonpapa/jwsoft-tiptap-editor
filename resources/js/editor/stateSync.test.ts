import { ensureHtmlMode, syncEditorValue } from "@/editor/stateSync";
import type { G7CoreApi } from "@/g7/types";

describe("G7 state synchronization", () => {
  it("uses G7 debounce options and marks user changes", () => {
    const setLocal = vi.fn();
    const core: G7CoreApi = {
      state: {
        getLocal: () => ({ form: { content: "before" } }),
        setLocal,
      },
    };

    expect(
      syncEditorValue({
        core,
        name: "content",
        locale: "ko",
        value: "after",
        multilingual: false,
      }),
    ).toBe(true);
    expect(setLocal).toHaveBeenCalledWith(
      {
        "form.content": "after",
        "form.content_mode": "html",
        hasChanges: true,
      },
      {
        debounce: 300,
        debounceKey: "jwsoft-tiptap-sync-content",
        render: false,
        selfManaged: true,
      },
    );
  });

  it("does not overwrite identical latest state", () => {
    const setLocal = vi.fn();
    const core: G7CoreApi = {
      state: { getLocal: () => ({ form: { content: "same" } }), setLocal },
    };
    expect(
      syncEditorValue({
        core,
        name: "content",
        locale: "ko",
        value: "same",
        multilingual: false,
      }),
    ).toBe(false);
    expect(setLocal).not.toHaveBeenCalled();
  });

  it("sets html mode without marking the initial mount as changed", () => {
    const setLocal = vi.fn();
    ensureHtmlMode(
      { state: { getLocal: () => ({ form: {} }), setLocal } },
      "content",
    );
    expect(setLocal).toHaveBeenCalledWith({ "form.content_mode": "html" });
  });
});
