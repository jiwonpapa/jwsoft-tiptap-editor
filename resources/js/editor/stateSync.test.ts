import {
  ensureHtmlMode,
  setEditorPolicyAcknowledgement,
  syncEditorValue,
} from "@/editor/stateSync";
import type { G7CoreApi } from "@/g7/types";

describe("G7 state synchronization", () => {
  it("debounces changes and refreshes the G7 submission snapshot", () => {
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
        render: true,
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

  it("sets and clears the server policy acknowledgement without marking changes", () => {
    const setLocal = vi.fn();
    const core: G7CoreApi = { state: { setLocal } };

    setEditorPolicyAcknowledgement(core, true);
    expect(setLocal).toHaveBeenLastCalledWith(
      {
        "form.jwsoft_editor_policy_ack": expect.any(String),
      },
      { render: false, selfManaged: true },
    );
    setEditorPolicyAcknowledgement(core, false);
    expect(setLocal).toHaveBeenLastCalledWith(
      {
        "form.jwsoft_editor_policy_ack": null,
      },
      { render: false, selfManaged: true },
    );
  });
});
