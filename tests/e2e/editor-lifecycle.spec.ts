import { expect, test } from "@playwright/test";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { recordBrowserEvidence, mountEditor } from "./editor-fixture";

test("Chromium Korean IME paste undo and redo preserve canonical content", async ({
  context,
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desktop");
  await context.grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: "http://127.0.0.1",
  });
  await mountEditor(
    page,
    "standard",
    false,
    false,
    false,
    false,
    "<p></p>",
    "http://127.0.0.1",
  );

  const editable = page.locator(".jwsoft-tiptap-editable");
  await editable.focus();
  await editable.evaluate((element) => {
    const runtime = window as typeof window & {
      __imeEvents: Array<{
        type: string;
        data: string | null;
        inputType?: string;
        isComposing?: boolean;
      }>;
    };
    runtime.__imeEvents = [];
    for (const type of [
      "compositionstart",
      "compositionupdate",
      "compositionend",
      "beforeinput",
      "input",
    ]) {
      element.addEventListener(type, (event) => {
        const input = event as InputEvent;
        runtime.__imeEvents.push({
          type: event.type,
          data: input.data,
          inputType: input.inputType || undefined,
          isComposing: input.isComposing,
        });
      });
    }
  });

  const cdp = await context.newCDPSession(page);
  for (const candidates of [
    ["ㅎ", "하", "한", "한ㄱ", "한그", "한글"],
    ["ㅇ", "이", "입", "입ㄹ", "입려", "입력"],
  ]) {
    for (const candidate of candidates) {
      await cdp.send("Input.imeSetComposition", {
        text: candidate,
        selectionStart: candidate.length,
        selectionEnd: candidate.length,
      });
    }
    await cdp.send("Input.insertText", {
      text: candidates[candidates.length - 1]!,
    });
    if (candidates[0] === "ㅎ") await page.keyboard.press("Space");
  }
  await expect(editable).toHaveText("한글 입력");

  await page.waitForTimeout(650);
  await page.evaluate(async () => {
    await navigator.clipboard.write([
      new ClipboardItem({
        "text/html": new Blob(
          [
            '<strong style="color:red" onclick="alert(1)">붙여넣기</strong><script>alert(1)</script>',
          ],
          { type: "text/html" },
        ),
        "text/plain": new Blob(["붙여넣기"], { type: "text/plain" }),
      }),
    ]);
  });
  await editable.focus();
  await page.keyboard.press("ControlOrMeta+V");
  await expect(editable).toHaveText("한글 입력붙여넣기");
  await expect(editable.locator("[style], [onclick], script")).toHaveCount(0);
  await expect(page.locator(".jwsoft-tiptap-status")).toContainText("실행취소");

  const undo = page.getByTitle("실행취소 (Ctrl/Command+Z)");
  const redo = page.getByTitle("다시실행 (Ctrl/Command+Shift+Z)");
  await expect(undo).toBeEnabled();
  await undo.click();
  await expect(editable).toHaveText("한글 입력");
  await expect(redo).toBeEnabled();
  await redo.click();
  await expect(editable).toHaveText("한글 입력붙여넣기");

  await editable.focus();
  await page.keyboard.press("ControlOrMeta+Z");
  await expect(editable).toHaveText("한글 입력");
  await page.keyboard.press("ControlOrMeta+Shift+Z");
  await expect(editable).toHaveText("한글 입력붙여넣기");

  const result = await page.evaluate(() => {
    const runtime = window as typeof window & {
      __imeEvents: Array<{
        type: string;
        data: string | null;
        inputType?: string;
        isComposing?: boolean;
      }>;
      __e2eStateUpdates: Array<{
        updates: Record<string, unknown>;
        options?: Record<string, unknown>;
      }>;
    };
    const contentUpdates = runtime.__e2eStateUpdates.filter(
      ({ updates }) => typeof updates["form.content"] === "string",
    );
    return {
      html:
        document.querySelector<HTMLElement>(".jwsoft-tiptap-editable")
          ?.innerHTML ?? "",
      compositionEvents: runtime.__imeEvents,
      contentUpdateCount: contentUpdates.length,
      finalStateHtml:
        (contentUpdates[contentUpdates.length - 1]?.updates["form.content"] as
          string | undefined) ?? "",
      debounceOptions: contentUpdates.map(({ options }) => options),
    };
  });
  const compositionStarts = result.compositionEvents.filter(
    ({ type }) => type === "compositionstart",
  );
  const compositionEnds = result.compositionEvents.filter(
    ({ type }) => type === "compositionend",
  );
  expect(compositionStarts).toHaveLength(2);
  expect(compositionEnds.map(({ data }) => data)).toEqual(["한글", "입력"]);
  expect(
    result.compositionEvents.some(
      ({ inputType, isComposing }) =>
        inputType === "insertCompositionText" && isComposing,
    ),
  ).toBe(true);
  expect(result.html).toBe("<p>한글 입력<strong>붙여넣기</strong></p>");
  expect(result.finalStateHtml).toBe(result.html);
  expect(result.contentUpdateCount).toBeGreaterThan(0);
  expect(
    result.debounceOptions.every(
      (options) =>
        options?.debounce === 300 &&
        options.debounceKey === "jwsoft-tiptap-sync-content" &&
        options.render === true &&
        options.selfManaged === true,
    ),
  ).toBe(true);

  const screenshotPath = testInfo.outputPath("editor-ime-history-paste.png");
  await page.screenshot({ path: screenshotPath, fullPage: true });
  recordBrowserEvidence("editor-ime.json", testInfo.project.name, {
    inputBoundary: "Chromium CDP Input.imeSetComposition",
    compositionStartCount: compositionStarts.length,
    compositionEndData: compositionEnds.map(({ data }) => data),
    composingInputObserved: true,
    toolbarUndoRedo: true,
    keyboardUndoRedo: true,
    clipboardApiPaste: true,
    sanitizedPaste: true,
    finalHtml: result.html,
    finalStateHtml: result.finalStateHtml,
    contentUpdateCount: result.contentUpdateCount,
    debounceMs: 300,
    submissionSnapshotRefresh: true,
    screenshotSha256: createHash("sha256")
      .update(fs.readFileSync(screenshotPath))
      .digest("hex"),
    physicalMobileIme: "not-observed",
  });
});

test("100 route replacements leave no detached editor instances", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desktop");
  await mountEditor(page);

  const result = await page.evaluate(async () => {
    const runtime = window as typeof window & {
      __e2eHandlers: Record<
        string,
        (action: Record<string, unknown>, context: unknown) => unknown
      >;
      __JWSoftTiptapEditor: { getInstanceCount: () => number };
    };
    const nextTask = () =>
      new Promise<void>((resolve) => window.setTimeout(resolve, 0));
    const detachedCounts: number[] = [];
    const mountedCounts: number[] = [];
    let maxInstances = runtime.__JWSoftTiptapEditor.getInstanceCount();

    for (let route = 0; route < 100; route += 1) {
      document.getElementById("jwsoft-tiptap-content")?.remove();
      await nextTask();
      const detachedCount = runtime.__JWSoftTiptapEditor.getInstanceCount();
      detachedCounts.push(detachedCount);
      if (detachedCount !== 0) {
        throw new Error(`route ${route + 1}: detached instance remained`);
      }

      const container = document.createElement("div");
      container.id = "jwsoft-tiptap-content";
      container.className = "jwsoft-tiptap-wrapper";
      document.querySelector("main")?.appendChild(container);
      await runtime.__e2eHandlers["jwsoft-tiptap-editor.initEditor"](
        {
          params: {
            name: "content",
            content: `<p>화면 ${route + 1}</p>`,
            toolbar: "standard",
          },
        },
        undefined,
      );
      const mountedCount = runtime.__JWSoftTiptapEditor.getInstanceCount();
      mountedCounts.push(mountedCount);
      maxInstances = Math.max(maxInstances, mountedCount);
      if (mountedCount !== 1) {
        throw new Error(`route ${route + 1}: expected one mounted instance`);
      }
    }

    document.getElementById("jwsoft-tiptap-content")?.remove();
    await nextTask();
    return {
      navigationCount: 100,
      detachedCounts,
      mountedCounts,
      maxInstances,
      finalInstances: runtime.__JWSoftTiptapEditor.getInstanceCount(),
    };
  });

  expect(result.detachedCounts.every((count) => count === 0)).toBe(true);
  expect(result.mountedCounts.every((count) => count === 1)).toBe(true);
  expect(result.maxInstances).toBe(1);
  expect(result.finalInstances).toBe(0);

  recordBrowserEvidence(
    "instance-lifecycle.json",
    testInfo.project.name,
    result,
  );
});
