import { initEditorHandler } from "@/handlers/initEditor";
import { editorRegistry } from "@/editor/editorRegistry";
import { EDITOR_POLICY_HASH } from "@/generated/editorPolicy";

const legacy = '<p style="color:red">기존 본문</p>';
let state: Record<string, unknown>;
function addContainer(name: string): HTMLElement {
  const container = document.createElement("div");
  container.id = `jwsoft-tiptap-${name}`;
  document.body.append(container);
  return container;
}
function tab(container: HTMLElement, index: number) {
  container.querySelectorAll<HTMLButtonElement>("[role=tab]")[index].click();
}
function approve(container: HTMLElement) {
  container.querySelector<HTMLButtonElement>("[data-primary=true]")!.click();
}
beforeEach(() => {
  document.body.replaceChildren();
  state = {};
  window.G7Core = {
    locale: { current: () => "ko", supported: () => ["ko", "en"] },
    state: {
      getLocal: () => ({ form: {} }),
      setLocal: (updates) => {
        Object.assign(state, updates);
      },
    },
  };
});
afterEach(() => editorRegistry.destroyAll());

it("does not publish unapproved HTML or grant consent when switching to a clean locale", async () => {
  const container = addContainer("content");
  await initEditorHandler(
    {
      params: {
        name: "content",
        multilingual: true,
        content: { ko: legacy, en: "<p>English</p>" },
      },
    },
    undefined,
  );
  tab(container, 1);
  expect(state["form.content.ko"]).toBeUndefined();
  expect(state["form.jwsoft_editor_policy_ack"]).toBeNull();
  tab(container, 0);
  expect(container.querySelector("[role=alert]")).not.toBeNull();
  expect(editorRegistry.get(container.id, "ko")!.isEditable).toBe(false);
  approve(container);
  expect(state["form.content.ko"]).toBe("<p>기존 본문</p>");
  expect(state["form.jwsoft_editor_policy_ack"]).toBe(EDITOR_POLICY_HASH);
});

it("keeps every unvisited locale and field unapproved until explicitly accepted", async () => {
  const first = addContainer("content");
  await initEditorHandler(
    {
      params: {
        name: "content",
        multilingual: true,
        content: { ko: legacy, en: legacy },
      },
    },
    undefined,
  );
  const second = addContainer("description");
  await initEditorHandler(
    { params: { name: "description", content: legacy } },
    undefined,
  );
  approve(first);
  expect(state["form.jwsoft_editor_policy_ack"]).toBeNull();
  tab(first, 1);
  approve(first);
  expect(state["form.jwsoft_editor_policy_ack"]).toBeNull();
  approve(second);
  expect(state["form.jwsoft_editor_policy_ack"]).toBe(EDITOR_POLICY_HASH);
});

it("offers a consent tab for a stored locale no longer configured by G7", async () => {
  const container = addContainer("content");
  await initEditorHandler(
    {
      params: {
        name: "content",
        multilingual: true,
        content: { ko: "<p>한국어</p>", ja: legacy },
      },
    },
    undefined,
  );
  const tabs = [
    ...container.querySelectorAll<HTMLButtonElement>(
      ".jwsoft-tiptap-locale-tabs [role=tab]",
    ),
  ];
  expect(tabs.map((button) => button.textContent)).toEqual([
    "한국어",
    "English",
    "日本語",
  ]);
  expect(state["form.jwsoft_editor_policy_ack"]).toBeNull();
  expect(state["form.content.ja"]).toBeUndefined();
  tabs[2].click();
  expect(editorRegistry.get(container.id, "ja")!.isEditable).toBe(false);
  approve(container);
  expect(state["form.content.ja"]).toBe("<p>기존 본문</p>");
  expect(state["form.jwsoft_editor_policy_ack"]).toBe(EDITOR_POLICY_HASH);
});

it.each([{ readOnly: true }, { disabled: true }])(
  "never syncs read-only locales on tab navigation: %o",
  async (flags) => {
    const container = addContainer("content");
    await initEditorHandler(
      {
        params: {
          name: "content",
          multilingual: true,
          content: { ko: legacy, en: "<p>English</p>" },
          ...flags,
        },
      },
      undefined,
    );
    tab(container, 1);
    tab(container, 0);
    expect(state).toEqual({});
    expect(editorRegistry.get(container.id, "ko")!.isEditable).toBe(false);
  },
);

it("keeps source untouched when read-only is chosen and another locale is opened", async () => {
  const container = addContainer("content");
  await initEditorHandler(
    { params: { multilingual: true, content: { ko: legacy, en: "" } } },
    undefined,
  );
  container
    .querySelectorAll<HTMLButtonElement>(".jwsoft-tiptap-legacy-action")[1]
    .click();
  tab(container, 1);
  expect(state["form.content.ko"]).toBeUndefined();
  expect(state["form.jwsoft_editor_policy_ack"]).toBeNull();
});
