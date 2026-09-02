import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { build } from "esbuild";
import { JSDOM, VirtualConsole } from "jsdom";

// Offline integration test: real G7 renderer/dispatcher plus the editor source.
// No authentication, HTTP writes, database bootstrap, or G7 file modifications.
const root = path.resolve(import.meta.dirname, "../..");
const g7Root = process.argv[2] ?? process.env.G7_ROOT;
assert(g7Root, "Pass a dedicated G7 checkout as the first argument or G7_ROOT");
const coreSource = fs.readFileSync(
  path.join(g7Root, "public/build/core/template-engine.min.js"),
  "utf8",
);
const postFormCandidates = [
  "templates/sirsoft-basic/layouts/partials/board/form/_post_form.json",
  "templates/_bundled/sirsoft-basic/layouts/partials/board/form/_post_form.json",
];
const postFormPath = postFormCandidates
  .map((candidate) => path.join(g7Root, candidate))
  .find((candidate) => fs.existsSync(candidate));
assert(
  postFormPath,
  `G7 board form template not found: ${postFormCandidates.join(", ")}`,
);
const postForm = JSON.parse(fs.readFileSync(postFormPath, "utf8"));
function findSaveSequence(value) {
  if (!value || typeof value !== "object") return undefined;
  if (
    value.handler === "sequence" &&
    value.actions?.some(
      (action) =>
        action.handler === "apiCall" && action.target?.includes("/posts"),
    )
  )
    return value;
  for (const child of Object.values(value)) {
    const result = findSaveSequence(child);
    if (result) return result;
  }
}
const sequence = findSaveSequence(postForm);
assert(sequence, "Installed template must expose its real save sequence");
const apiIndex = sequence.actions.findIndex(
  (action) => action.handler === "apiCall",
);
const editorSource = await build({
  stdin: {
    contents:
      'export { createEditor } from "./resources/js/editor/createEditor.ts"; export { syncEditorValue } from "./resources/js/editor/stateSync.ts"; export { installEditorSaveSync } from "./resources/js/editor/saveSync.ts";',
    resolveDir: root,
  },
  tsconfig: path.join(root, "tsconfig.json"),
  bundle: true,
  write: false,
  format: "iife",
  globalName: "EditorUnderTest",
  platform: "browser",
});
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function checkSave({
  label,
  initial = "",
  resize = true,
  immediate = false,
  multilingual = false,
  empty = false,
  rapidLocales = false,
  staleResponse = false,
}) {
  const errors = [];
  const console = new VirtualConsole();
  console.on("jsdomError", (error) => errors.push(error.message));
  const dom = new JSDOM('<div id="app"></div>', {
    url: "http://g7-offline.test/",
    runScripts: "outside-only",
    pretendToBeVisual: true,
    virtualConsole: console,
  });
  const w = dom.window;
  w.matchMedia = () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  });
  w.fetch = async () => ({ ok: true, json: async () => ({}) });
  w.eval(coreSource);
  w.eval(
    `${editorSource.outputFiles[0].text}\nwindow.EditorUnderTest = EditorUnderTest;`,
  );
  const core = w.G7Core;
  let editor;
  try {
    await core.initTemplateEngine({
      templateId: "state-sync-test",
      locale: "ko",
      debug: false,
    });
    const app = new core.TemplateApp({
      templateId: "state-sync-test",
      locale: "ko",
    });
    w.__templateApp = app;
    const dispatcher = core.getActionDispatcher();
    app.actionDispatcher = dispatcher;
    dispatcher.setGlobalStateUpdater((updates, options) =>
      app.setGlobalState(updates, options),
    );
    const baseline = {
      form: {
        title: "state sync",
        content: multilingual
          ? { ko: initial, en: "<p>Keep English</p>" }
          : initial,
        content_mode: "html",
      },
      isSaving: false,
    };
    app.setGlobalState({ _local: baseline }, { render: false });
    let submitted;
    dispatcher.registerHandler("captureSave", async (action) => {
      submitted = action.params.body;
    });
    core
      .getState()
      .registry.registerComponent(
        "EditorForm",
        (props) =>
          w.React.createElement(
            "section",
            { "data-snapshot": JSON.stringify(props.content) },
            w.React.createElement("div", { id: "editor" }),
            w.React.createElement(
              "button",
              { id: "save", onClick: props.onClick },
              "Save",
            ),
          ),
        { type: "basic", name: "EditorForm" },
      );
    await core.renderTemplate({
      containerId: "app",
      layoutJson: {
        components: [
          {
            id: "save-root",
            type: "basic",
            name: "EditorForm",
            props: { content: "{{_local.form.content}}" },
            actions: [
              {
                ...sequence,
                actions: [
                  ...sequence.actions.slice(0, apiIndex),
                  {
                    handler: "captureSave",
                    params: { body: sequence.actions[apiIndex].params.body },
                  },
                ],
              },
            ],
          },
        ],
      },
      dataContext: { _local: baseline, _global: app.getGlobalState() },
    });
    await wait(80);
    editor = w.EditorUnderTest.createEditor({
      element: w.document.getElementById("editor"),
      content: initial,
      placeholder: "",
      editable: true,
      onUpdate: (value) =>
        w.EditorUnderTest.syncEditorValue({
          core,
          name: "content",
          locale: "ko",
          value,
          multilingual,
        }),
    });
    w.EditorUnderTest.installEditorSaveSync(editor, () =>
      w.EditorUnderTest.syncEditorValue({
        core,
        name: "content",
        locale: "ko",
        value: editor.getHTML(),
        multilingual,
      }),
    );
    editor.commands.setContent("<p>새로 입력한 본문을 저장합니다</p>");
    if (empty) editor.commands.clearContent();
    if (rapidLocales) {
      w.EditorUnderTest.syncEditorValue({
        core,
        name: "content",
        locale: "en",
        value: "<p>New English</p>",
        multilingual: true,
      });
    }
    editor.commands.setTextSelection(8);
    const selection = editor.state.selection.from;
    if (!immediate) await wait(400);
    if (staleResponse) {
      // Mirrors the late check-slug response observed in the authenticated G7
      // page form: old local state replaces a settled self-managed field.
      app.setGlobalState({ _local: baseline });
      await wait(100);
    }
    if (resize) {
      w.innerWidth = 412;
      w.dispatchEvent(new w.Event("resize"));
      await wait(220);
      w.innerWidth = 1024;
      w.dispatchEvent(new w.Event("resize"));
      await wait(220);
    }
    assert.equal(
      editor.state.selection.from,
      selection,
      `${label}: selection retained`,
    );
    assert.equal(editor.isDestroyed, false, `${label}: editor stays mounted`);
    assert.equal(
      editor.view.dom.isConnected,
      true,
      `${label}: editor DOM remains in the G7 tree`,
    );
    w.document.getElementById("save").click();
    await wait(100);
    const saved = multilingual ? submitted?.content?.ko : submitted?.content;
    assert.equal(
      saved,
      empty ? "" : editor.getHTML(),
      `${label}: submitted content must equal editor HTML`,
    );
    if (!empty)
      assert(
        saved.includes("새로 입력한 본문"),
        `${label}: fresh input must survive`,
      );
    if (multilingual)
      assert.equal(
        submitted.content.en,
        rapidLocales ? "<p>New English</p>" : "<p>Keep English</p>",
      );
    assert.deepEqual(errors, [], `${label}: no DOM runtime errors`);
    return label;
  } finally {
    editor?.destroy();
    core.destroyTemplate();
    dom.window.close();
  }
}

for (const scenario of [
  {
    label: "late unrelated response cannot clear an edited body",
    staleResponse: true,
    resize: false,
  },
  {
    label: "late unrelated response cannot clear localized content",
    staleResponse: true,
    multilingual: true,
  },
  { label: "new document without resize", resize: false },
  { label: "new document after resize" },
  { label: "edited document after resize", initial: "<p>이전 본문</p>" },
  { label: "immediate save flushes debounce", immediate: true, resize: false },
  { label: "localized content after resize", multilingual: true },
  {
    label: "rapid language switching preserves both pending locales",
    multilingual: true,
    rapidLocales: true,
    immediate: true,
    resize: false,
  },
  {
    label: "rapid language switching settles both locales after resize",
    multilingual: true,
    rapidLocales: true,
  },
  {
    label:
      "clearing one locale then editing another preserves the cleared value",
    multilingual: true,
    rapidLocales: true,
    empty: true,
    immediate: true,
    resize: false,
  },
  {
    label: "delete all then immediate save submits empty",
    empty: true,
    immediate: true,
    resize: false,
  },
  {
    label: "empty localized content retains other languages",
    empty: true,
    multilingual: true,
  },
]) {
  process.stdout.write(`[jwsoft] ${await checkSave(scenario)}: pass\n`);
}
