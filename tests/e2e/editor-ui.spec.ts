import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

import { expect, type Page, test } from "@playwright/test";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const bundlePath = path.join(root, "dist/js/plugin.iife.js");

function recordBrowserEvidence(
  file: string,
  browser: string,
  result: Record<string, unknown>,
): void {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(root, "plugin.json"), "utf8"),
  ) as { version: string };
  const sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8",
  }).trim();
  const evidenceDirectory = path.join(root, "test-results/parity/browser");
  fs.mkdirSync(evidenceDirectory, { recursive: true });
  fs.writeFileSync(
    path.join(evidenceDirectory, file),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        status: "pass",
        observedAt: new Date().toISOString(),
        browser,
        pluginVersion: manifest.version,
        sourceCommit,
        runtimeSha256: createHash("sha256")
          .update(fs.readFileSync(bundlePath))
          .digest("hex"),
        ...result,
      },
      null,
      2,
    )}\n`,
  );
}

async function mountEditor(
  page: Page,
  toolbar = "standard",
  imageUpload = false,
  mediaEmbed = false,
  videoUpload = false,
  smartCards = false,
  content = "<p>선택 영역 테스트</p>",
  origin = "http://jwsoft.test",
): Promise<void> {
  await page.route(`${origin}/`, (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<!doctype html>
        <html lang="ko">
          <head><meta name="viewport" content="width=device-width, initial-scale=1"></head>
          <body><main><div id="jwsoft-tiptap-content" class="jwsoft-tiptap-wrapper"></div></main></body>
        </html>`,
    }),
  );
  await page.goto(`${origin}/`);
  await page.evaluate(() => {
    const handlers: Record<string, (...args: unknown[]) => unknown> = {};
    const stateUpdates: Array<{
      updates: Record<string, unknown>;
      options?: Record<string, unknown>;
    }> = [];
    const dispatcher = {
      registerHandler(name: string, handler: (...args: unknown[]) => unknown) {
        handlers[name] = handler;
      },
    };
    Object.assign(window, {
      __e2eHandlers: handlers,
      __e2eStateUpdates: stateUpdates,
      G7Core: {
        locale: { current: () => "ko", supported: () => ["ko"] },
        state: {
          getLocal: () => ({ form: { content_mode: "html" } }),
          setLocal: (
            updates: Record<string, unknown>,
            options?: Record<string, unknown>,
          ) => stateUpdates.push({ updates, options }),
        },
        getActionDispatcher: () => dispatcher,
      },
    });
  });
  await page.addScriptTag({ path: bundlePath });
  await page.evaluate(
    async ({
      profile,
      withImageUpload,
      withMediaEmbed,
      withVideoUpload,
      withSmartCards,
      initialContent,
    }) => {
      const runtime = window as typeof window & {
        __e2eHandlers: Record<
          string,
          (action: Record<string, unknown>, context: unknown) => unknown
        >;
      };
      await runtime.__e2eHandlers["jwsoft-tiptap-editor.initEditor"](
        {
          params: {
            name: "content",
            content: initialContent,
            height: 280,
            toolbar: profile,
            imageUpload: withImageUpload,
            mediaEmbed: withMediaEmbed,
            videoUpload: withVideoUpload,
            videoMaxSizeMb: 200,
            smartCards: withSmartCards,
            autoSmartCards: withSmartCards,
            autoEmbedUrls: withMediaEmbed,
            youtubeEmbed: true,
            vimeoEmbed: true,
            mp4Embed: true,
            imageMaxSizeMb: 2,
          },
        },
        undefined,
      );
    },
    {
      profile: toolbar,
      withImageUpload: imageUpload,
      withMediaEmbed: mediaEmbed,
      withVideoUpload: videoUpload,
      withSmartCards: smartCards,
      initialContent: content,
    },
  );
}

async function insertTool(page: Page, name: string) {
  const direct = page
    .locator(".jwsoft-tiptap-toolbar")
    .getByRole("button", { name, exact: true });
  if (await direct.isVisible()) await direct.click();
  else {
    await page.getByRole("button", { name: "삽입 도구", exact: true }).click();
    await page
      .getByRole("dialog", { name: "삽입 도구", exact: true })
      .getByRole("button", { name, exact: true })
      .click();
  }
}

async function menuAction(page: Page, name: string, action: string) {
  const panel = page.getByRole("dialog", { name, exact: true });
  if (!(await panel.isVisible()))
    await page.getByRole("button", { name, exact: true }).click();
  await panel.getByRole("button", { name: action, exact: true }).click();
}

test("focused menus expose named tools and keyboard actions without mixing categories", async ({
  page,
}, testInfo) => {
  await mountEditor(page, "full");
  const more = page.getByRole("button", { name: "도구 더보기", exact: true });
  await more.focus();
  await page.keyboard.press("ArrowDown");
  const panel = page.getByRole("dialog", { name: "도구 더보기", exact: true });
  await expect(panel).toBeVisible();
  await expect(
    panel.locator("[data-editor-command] .jwsoft-menu-text"),
  ).toHaveText(["찾기 / 바꾸기", "전체화면"]);
  await expect(
    panel.getByRole("button", { name: "찾기 / 바꾸기", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(
    panel.getByRole("button", { name: "전체화면", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(more).toBeFocused();
  await expect(panel).not.toBeVisible();
  const editable = page.locator(".jwsoft-tiptap-editable");
  await editable.click();
  await page.keyboard.press("ControlOrMeta+A");
  await menuAction(page, "목록", "번호 목록");
  await expect(editable.locator("ol li")).toHaveText("선택 영역 테스트");
  await expect(editable).toBeFocused();
  await editable.locator("ol li").click();
  await page.getByRole("button", { name: "목록", exact: true }).click();
  const lists = page.getByRole("dialog", { name: "목록", exact: true });
  await expect(
    lists.getByRole("button", { name: "번호 목록", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(lists.locator(".jwsoft-menu-text")).toHaveText([
    "글머리 목록",
    "번호 목록",
    "체크리스트",
  ]);
  await page.screenshot({
    path: testInfo.outputPath("editor-list-menu.png"),
    fullPage: true,
    animations: "disabled",
  });
  await page.keyboard.press("Escape");
  await more.click();
  await page.screenshot({
    path: testInfo.outputPath("editor-more-menu.png"),
    fullPage: true,
    animations: "disabled",
  });
  await panel
    .getByRole("button", { name: "찾기 / 바꾸기", exact: true })
    .click();
  await expect(panel).not.toBeVisible();
  const find = page.getByRole("dialog", { name: "찾기 / 바꾸기", exact: true });
  await expect(find).toBeVisible();
  await expect(page.locator("dialog[open]")).toHaveCount(1);
  await find.getByRole("button", { name: "닫기", exact: true }).click();
  await expect(more).toBeFocused();
});

test("toolbar keeps history visible at 360 390 768 and 1280 pixels", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desktop");
  await mountEditor(page, "full", false, true, false, true);
  const toolbar = page.locator(".jwsoft-tiptap-toolbar");
  for (const width of [1280, 768, 390, 360, 1280]) {
    await page.setViewportSize({ width, height: 840 });
    const folded = toolbar.getByRole("button", {
      name: "삽입 도구",
      exact: true,
    });
    if (width < 768) await expect(folded).toBeVisible();
    if (width === 1280) await expect(folded).not.toBeVisible();
    await expect(
      toolbar.getByRole("button", { name: /^실행취소/ }),
    ).toBeVisible();
    await expect(
      toolbar.getByRole("button", { name: /^다시실행/ }),
    ).toBeVisible();
    const metrics = await toolbar.evaluate((element) => ({
      width: element.clientWidth,
      scroll: element.scrollWidth,
      height: element.getBoundingClientRect().height,
      page: document.documentElement.scrollWidth,
      viewport: window.innerWidth,
    }));
    expect(metrics.scroll).toBeLessThanOrEqual(metrics.width);
    expect(metrics.page).toBeLessThanOrEqual(metrics.viewport);
    expect(metrics.height).toBeLessThanOrEqual(width <= 640 ? 104 : 52);
    await page.screenshot({
      path: testInfo.outputPath(`toolbar-${width}.png`),
      fullPage: true,
      animations: "disabled",
    });
  }
  // Narrow embedded editors fold on container width even on a wide desktop.
  await page.locator("main").evaluate((element) => {
    element.style.width = "360px";
  });
  await expect(
    toolbar.getByRole("button", { name: "삽입 도구", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "문단 모양", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "문단 모양", exact: true }),
  ).toHaveAttribute("data-presentation", "popover");
});

test("mobile formatting sheet preserves selection traps focus and returns to visible triggers", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-mobile");
  await mountEditor(page, "standard");
  const editable = page.locator(".jwsoft-tiptap-editable");
  await editable.click();
  await page.keyboard.press("ControlOrMeta+A");
  const top = await editable.evaluate(
    (element) => element.getBoundingClientRect().top,
  );
  const trigger = page.getByRole("button", { name: "문단 모양", exact: true });
  await trigger.click();
  const sheet = page.getByRole("dialog", { name: "문단 모양", exact: true });
  await expect(sheet).toHaveAttribute("data-presentation", "sheet");
  await expect(sheet).toHaveAttribute("aria-modal", "true");
  const box = await sheet.boundingBox();
  expect(box!.y + box!.height).toBeGreaterThan(
    (await page.evaluate(() => window.innerHeight)) - 20,
  );
  for (let step = 0; step < 9; step++) {
    await page.keyboard.press("Tab");
    expect(
      await sheet.evaluate((element) =>
        element.contains(document.activeElement),
      ),
    ).toBe(true);
  }
  await sheet
    .getByLabel("정렬", { exact: true })
    .selectOption("jw-align-center");
  await expect(editable.locator("p.jw-align-center")).toHaveText(
    "선택 영역 테스트",
  );
  await sheet
    .getByLabel("줄 간격", { exact: true })
    .selectOption("jw-space-relaxed");
  await page.screenshot({
    path: testInfo.outputPath("editor-paragraph-sheet.png"),
    fullPage: true,
    animations: "disabled",
  });
  await sheet.getByRole("button", { name: "들여쓰기", exact: true }).click();
  await expect(sheet).not.toBeVisible();
  await expect(editable).toBeFocused();
  await expect(
    editable.locator("p.jw-align-center.jw-space-relaxed.jw-indent-1"),
  ).toHaveCount(1);
  expect(
    await editable.evaluate((element) => element.getBoundingClientRect().top),
  ).toBe(top);
  await insertTool(page, "이미지");
  await expect(page.locator("dialog[open]")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "삽입 도구", exact: true }),
  ).toBeFocused();
  await page.getByRole("button", { name: "글자 모양", exact: true }).click();
  const textSheet = page.getByRole("dialog", {
    name: "글자 모양",
    exact: true,
  });
  await textSheet
    .getByLabel("글자 크기", { exact: true })
    .selectOption("jw-font-20");
  await page.screenshot({
    path: testInfo.outputPath("editor-text-sheet.png"),
    fullPage: true,
    animations: "disabled",
  });
  await textSheet
    .getByRole("button", { name: "글자색: 파랑", exact: true })
    .click();
  await expect(editable.locator("span.jw-color-blue.jw-font-20")).toHaveText(
    "선택 영역 테스트",
  );
  await expect(textSheet).not.toBeVisible();
  await expect(editable).toBeFocused();
});

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

test("link quote lists alignment and indentation use policy-safe controls", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desktop");
  await mountEditor(
    page,
    "standard",
    false,
    false,
    false,
    false,
    "<p>첫째 링크</p><p>둘째 링크</p>",
  );
  const editable = page.locator(".jwsoft-tiptap-editable");
  await editable.click();
  await page.keyboard.press("ControlOrMeta+A");

  await insertTool(page, "링크");
  const linkDialog = page.getByRole("dialog", { name: "링크" });
  await linkDialog.getByLabel("주소").fill("https://example.com/proof");
  await linkDialog.getByRole("button", { name: "링크 적용" }).click();
  await expect(editable.locator("a")).toHaveCount(2);

  await page.getByRole("button", { name: "문단 모양", exact: true }).click();
  await page
    .getByLabel("정렬", { exact: true })
    .selectOption("jw-align-center");
  await page.getByRole("button", { name: "들여쓰기", exact: true }).click();
  const alignedIndentedParagraphs = editable.locator(
    "p.jw-align-center.jw-indent-1",
  );
  await expect(alignedIndentedParagraphs).toHaveCount(2);
  const alignedIndentedCount = await alignedIndentedParagraphs.count();
  await menuAction(page, "문단 모양", "내어쓰기");
  await expect(editable.locator("p.jw-indent-1")).toHaveCount(0);
  await menuAction(page, "문단 모양", "들여쓰기");

  await menuAction(page, "문단 모양", "인용");
  await expect(editable.locator("blockquote")).toHaveCount(1);
  const blockquoteAppliedCount = await editable.locator("blockquote").count();
  await menuAction(page, "목록", "글머리 목록");
  await expect(editable.locator("ul")).toHaveCount(1);
  const bulletListAppliedCount = await editable.locator("ul").count();
  await menuAction(page, "목록", "글머리 목록");
  await menuAction(page, "목록", "번호 목록");
  await expect(editable.locator("ol")).toHaveCount(1);

  await page.keyboard.press("Escape");
  await editable.locator("li").nth(1).click();
  await menuAction(page, "문단 모양", "들여쓰기");
  await expect(editable.locator("ol")).toHaveCount(2);
  const nestedOrderedListCount = await editable.locator("ol").count();
  await menuAction(page, "문단 모양", "내어쓰기");
  await expect(editable.locator("ol")).toHaveCount(1);
  await expect(editable.locator("[style]")).toHaveCount(0);

  recordBrowserEvidence("editor-indentation.json", testInfo.project.name, {
    linkCount: await editable.locator("a").count(),
    blockquoteAppliedCount,
    bulletListAppliedCount,
    orderedListCount: await editable.locator("ol").count(),
    alignedIndentedCount,
    indentationToken: "jw-indent-1",
    nestedOrderedListCount,
    listIndentationRoundTrip: true,
    inlineStyleCount: await editable.locator("[style]").count(),
  });
});

test("desktop toolbar keeps selection commands and keyboard focus usable", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desktop");
  await mountEditor(page);
  const editable = page.locator(".jwsoft-tiptap-editable");
  const bold = page
    .locator(".jwsoft-tiptap-toolbar")
    .getByRole("button", { name: /굵게/ });
  await bold.focus();
  await expect(bold).toBeFocused();
  await page.keyboard.press("ArrowRight");
  const focused = await page.evaluate(() => ({
    text: document.activeElement?.textContent,
    tag: document.activeElement?.tagName,
    disabled: (document.activeElement as HTMLButtonElement | null)?.disabled,
  }));
  expect(focused).toEqual({ text: "기울임", tag: "BUTTON", disabled: false });

  await editable.click();
  await page.keyboard.press("ControlOrMeta+A");
  await bold.click();
  await expect(editable.locator("strong")).toHaveText("선택 영역 테스트");

  await page.screenshot({
    path: testInfo.outputPath("editor-toolbar-desktop.png"),
    fullPage: true,
    animations: "disabled",
  });
});

test("mobile toolbar uses grouped menus and a non-reflowing modal", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-mobile");
  await mountEditor(page, "full");
  const toolbar = page.getByRole("toolbar");
  const metrics = await toolbar.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
    pageWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth);
  expect(metrics.pageWidth).toBeLessThanOrEqual(metrics.viewportWidth);

  const boldBox = await page
    .getByRole("button", { name: /굵게/ })
    .boundingBox();
  expect(boldBox?.height).toBeGreaterThanOrEqual(44);
  const editorTop = await page
    .locator(".jwsoft-tiptap-editable")
    .evaluate((element) => element.getBoundingClientRect().top);
  await insertTool(page, "이미지");
  const dialog = page.getByRole("dialog", { name: "이미지" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute("aria-modal", "true");
  await expect
    .poll(() => dialog.evaluate((element) => getComputedStyle(element).opacity))
    .toBe("1");
  expect(
    await page
      .locator(".jwsoft-tiptap-editable")
      .evaluate((element) => element.getBoundingClientRect().top),
  ).toBe(editorTop);
  const dialogBox = await dialog.boundingBox();
  expect(dialogBox?.x).toBeGreaterThanOrEqual(0);
  expect((dialogBox?.x ?? 0) + (dialogBox?.width ?? 0)).toBeLessThanOrEqual(
    await page.evaluate(() => window.innerWidth),
  );

  await page.screenshot({
    path: testInfo.outputPath("editor-toolbar-mobile.png"),
    fullPage: true,
    animations: "disabled",
  });
});

test("image upload supports caption alignment size and responsive output", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desktop");
  await page.route(
    "http://jwsoft.test/api/plugins/jwsoft-tiptap-editor/upload",
    async (route) => {
      expect(route.request().method()).toBe("POST");
      expect(route.request().postDataBuffer()?.length).toBeGreaterThan(0);
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          message: "이미지를 업로드했습니다.",
          data: {
            download_url:
              "/api/plugins/jwsoft-tiptap-editor/images/abcdef123456",
            original_name: "proof.png",
          },
        }),
      });
    },
  );
  await page.route(
    "http://jwsoft.test/api/plugins/jwsoft-tiptap-editor/images/abcdef123456",
    (route) =>
      route.fulfill({
        contentType: "image/png",
        body: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
          "base64",
        ),
      }),
  );
  await mountEditor(page, "standard", true);
  await insertTool(page, "이미지");
  const dialog = page.getByRole("dialog", { name: "이미지" });
  await dialog.getByLabel("이미지 파일").setInputFiles({
    name: "proof.png",
    mimeType: "image/png",
    buffer: Buffer.from("browser-upload-proof"),
  });
  await dialog.locator("summary").click();
  await dialog.getByLabel("대체 텍스트").fill("업로드 증빙");
  await dialog.getByLabel("캡션").fill("초기 캡션");
  await dialog.getByRole("button", { name: "업로드 후 삽입" }).click();

  const figure = page.locator(".jwsoft-tiptap-editable figure.jw-image");
  const image = page.locator(".jwsoft-tiptap-editable img");
  await expect(image).toHaveAttribute(
    "src",
    "/api/plugins/jwsoft-tiptap-editor/images/abcdef123456",
  );
  await expect(image).toHaveAttribute("alt", "업로드 증빙");
  await expect(figure.locator("figcaption")).toHaveText("초기 캡션");

  await figure.click();
  await insertTool(page, "이미지");
  await expect(
    dialog.getByRole("button", { name: "이미지 적용" }),
  ).toBeVisible();
  await dialog.getByLabel("캡션").fill("업로드 캡션");
  await dialog.getByLabel("이미지 정렬").selectOption("right");
  await dialog.getByLabel("이미지 크기").selectOption("50");
  await dialog.getByRole("button", { name: "이미지 적용" }).click();

  await expect(figure).toHaveClass(
    /jw-image jw-image-align-right jw-image-size-50/,
  );
  await expect(figure.locator("figcaption")).toHaveText("업로드 캡션");
  const desktop = await figure.evaluate((element) => ({
    figureWidth: element.getBoundingClientRect().width,
    editorWidth:
      element.closest(".jwsoft-tiptap-editable")?.getBoundingClientRect()
        .width ?? 0,
  }));
  expect(desktop.figureWidth).toBeGreaterThan(0);
  expect(desktop.figureWidth).toBeLessThanOrEqual(desktop.editorWidth);

  await page.setViewportSize({ width: 412, height: 915 });
  const mobile = await figure.evaluate((element) => ({
    figureWidth: element.getBoundingClientRect().width,
    editorWidth:
      element.closest(".jwsoft-tiptap-editable")?.getBoundingClientRect()
        .width ?? 0,
    pageWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));
  expect(mobile.figureWidth).toBeLessThanOrEqual(mobile.editorWidth);
  expect(mobile.pageWidth).toBeLessThanOrEqual(mobile.viewportWidth);
  await expect(page.locator(".jwsoft-tiptap-editable [style]")).toHaveCount(0);

  await page.screenshot({
    path: testInfo.outputPath("editor-image-layout-mobile.png"),
    fullPage: true,
    animations: "disabled",
  });
  recordBrowserEvidence("editor-image-layout.json", testInfo.project.name, {
    uploadInserted: true,
    canonicalUrl: await image.getAttribute("src"),
    caption: await figure.locator("figcaption").textContent(),
    alignmentToken: "jw-image-align-right",
    sizeToken: "jw-image-size-50",
    desktop,
    mobile,
    inlineStyleCount: await page
      .locator(".jwsoft-tiptap-editable [style]")
      .count(),
  });
});

test("media URL creates safe canonical HTML and a click-to-load responsive player", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desktop");
  await mountEditor(page, "standard", false, true);
  await insertTool(page, "동영상");
  const dialog = page.getByRole("dialog", { name: "동영상" });
  await dialog.getByLabel("동영상 URL").fill("https://youtu.be/dQw4w9WgXcQ");
  await dialog.getByRole("button", { name: "동영상 삽입" }).click();

  const media = page.locator(".jwsoft-tiptap-editable figure.jw-media-youtube");
  await expect(media).toBeVisible();
  await expect(media.locator("a.jw-media-source")).toHaveAttribute(
    "href",
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  );
  await expect(media.locator("iframe, video")).toHaveCount(0);

  await page.evaluate(async () => {
    const runtime = window as typeof window & {
      __e2eHandlers: Record<
        string,
        (action: Record<string, unknown>, context: unknown) => unknown
      >;
    };
    const output = document.createElement("div");
    output.className = "jwsoft-tiptap-content";
    output.innerHTML = `<figure class="jw-media jw-media-16x9 jw-media-youtube"><a class="jw-media-source" href="https://www.youtube.com/watch?v=dQw4w9WgXcQ">YouTube video</a></figure>`;
    document.body.appendChild(output);
    await runtime.__e2eHandlers["jwsoft-tiptap-editor.injectContentStyles"](
      { params: { externalMediaLoadMode: "click", mediaAutoplay: false } },
      undefined,
    );
    await Promise.resolve();
  });
  const output = page.locator(".jwsoft-tiptap-content figure.jw-media");
  await output.getByRole("button", { name: /YouTube 플레이어/ }).click();
  await expect(output.locator("iframe")).toHaveAttribute(
    "src",
    /youtube-nocookie\.com\/embed\/dQw4w9WgXcQ/,
  );
  const box = await output.boundingBox();
  expect((box?.width ?? 0) / (box?.height ?? 1)).toBeCloseTo(16 / 9, 1);
});

test("MP4 file uses the chunk protocol and inserts a canonical responsive media node", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desktop");
  const token = "0123456789abcdef0123456789abcdef";
  let partRequests = 0;
  await page.route(
    "http://jwsoft.test/api/plugins/jwsoft-tiptap-editor/media/uploads**",
    async (route) => {
      const request = route.request();
      const url = request.url();
      if (url.endsWith("/media/uploads")) {
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: {
              upload_token: token,
              chunk_size: 32,
              total_parts: 1,
              received_parts: [],
            },
          }),
        });
        return;
      }
      if (url.endsWith("/parts/0")) {
        partRequests += 1;
        expect(request.method()).toBe("PUT");
        expect(request.postDataBuffer()?.length).toBeGreaterThan(32);
        await route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({ success: true, data: {} }),
        });
        return;
      }
      if (url.endsWith("/complete")) {
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: {
              download_url:
                "/api/plugins/jwsoft-tiptap-editor/media/abcdef123456",
            },
          }),
        });
        return;
      }
      await route.abort();
    },
  );
  await mountEditor(page, "standard", false, true, true);
  await insertTool(page, "동영상");
  const dialog = page.getByRole("dialog", { name: "동영상" });
  await dialog.getByRole("tab", { name: "MP4 업로드" }).click();
  await dialog.getByLabel("MP4 파일").setInputFiles({
    name: "proof.mp4",
    mimeType: "video/mp4",
    buffer: Buffer.from([
      0, 0, 0, 24, 102, 116, 121, 112, 105, 115, 111, 109, 0, 0, 0, 0, 105, 115,
      111, 109, 109, 112, 52, 49, 0, 0, 0, 8, 109, 100, 97, 116,
    ]),
  });
  await dialog.getByRole("button", { name: "업로드 후 삽입" }).click();

  const media = page.locator(".jwsoft-tiptap-editable figure.jw-media-mp4");
  await expect(media.locator("a.jw-media-source")).toHaveText("proof.mp4");
  await expect(media.locator("a.jw-media-source")).toHaveAttribute(
    "href",
    "/api/plugins/jwsoft-tiptap-editor/media/abcdef123456",
  );
  await expect(media.locator("iframe, video")).toHaveCount(0);
  expect(partRequests).toBe(1);
});

test("pasted SNS URL becomes a safe canonical smart card", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desktop");
  await page.route(
    "http://jwsoft.test/api/plugins/jwsoft-tiptap-editor/link-preview",
    async (route) => {
      expect(route.request().method()).toBe("POST");
      expect(route.request().postDataJSON()).toEqual({
        url: "https://x.com/jwsoft/status/123",
      });
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            url: "https://x.com/jwsoft/status/123",
            provider: "x",
            provider_label: "X",
            title: "JWSoft update",
            description: "A safe social preview",
            image_url: null,
          },
        }),
      });
    },
  );
  await mountEditor(page, "standard", false, false, false, true);
  const editable = page.locator(".jwsoft-tiptap-editable");
  await editable.click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.press("Backspace");
  await editable.evaluate((element) => {
    const clipboard = new DataTransfer();
    clipboard.setData("text/plain", "https://x.com/jwsoft/status/123");
    element.dispatchEvent(
      new ClipboardEvent("paste", {
        bubbles: true,
        cancelable: true,
        clipboardData: clipboard,
      }),
    );
  });

  const card = editable.locator("figure.jw-card-x");
  await expect(card.locator("strong")).toHaveText("JWSoft update");
  await expect(card.locator("p")).toHaveText("A safe social preview");
  await expect(card.locator("a.jw-card-link")).toHaveAttribute(
    "href",
    "https://x.com/jwsoft/status/123",
  );
  await expect(card.locator("script, iframe, video")).toHaveCount(0);
});

test("link card toolbar inserts a generic HTTPS preview", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desktop");
  await page.route(
    "http://jwsoft.test/api/plugins/jwsoft-tiptap-editor/link-preview",
    (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            url: "https://example.com/article",
            provider: "generic",
            provider_label: "example.com",
            title: "Example article",
            description: "Generic preview",
            image_url: null,
          },
        }),
      }),
  );
  await mountEditor(page, "standard", false, false, false, true);
  await insertTool(page, "링크 카드");
  const dialog = page.getByRole("dialog", { name: "링크 카드" });
  await dialog.getByLabel("HTTPS 주소").fill("https://example.com/article");
  await dialog.getByRole("button", { name: "링크 카드 삽입" }).click();

  const card = page.locator(".jwsoft-tiptap-editable figure.jw-card-generic");
  await expect(card.locator("strong")).toHaveText("Example article");
  await expect(card.locator("a.jw-card-link")).toHaveAttribute(
    "rel",
    "noopener noreferrer",
  );
});

test("failed automatic preview preserves the original URL as a link", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desktop");
  await page.route(
    "http://jwsoft.test/api/plugins/jwsoft-tiptap-editor/link-preview",
    (route) =>
      route.fulfill({
        status: 422,
        contentType: "application/json",
        body: JSON.stringify({ success: false, message: "rejected" }),
      }),
  );
  await mountEditor(page, "standard", false, false, false, true);
  const editable = page.locator(".jwsoft-tiptap-editable");
  await editable.click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.press("Backspace");
  await editable.evaluate((element) => {
    const clipboard = new DataTransfer();
    clipboard.setData("text/plain", "https://example.com/preserved");
    element.dispatchEvent(
      new ClipboardEvent("paste", {
        bubbles: true,
        cancelable: true,
        clipboardData: clipboard,
      }),
    );
  });

  await expect(editable.locator("a")).toHaveAttribute(
    "href",
    "https://example.com/preserved",
  );
  await expect(editable.locator("a")).toHaveText(
    "https://example.com/preserved",
  );
});

test("inline appearance find-replace checklist and fullscreen stay policy-safe", async ({
  page,
}, testInfo) => {
  await mountEditor(
    page,
    "standard",
    false,
    false,
    false,
    false,
    "<p>가나다 가나다</p>",
  );
  const editable = page.locator(".jwsoft-tiptap-editable");
  await editable.click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.getByRole("button", { name: "글자 모양", exact: true }).click();
  await page
    .getByLabel("글자 크기", { exact: true })
    .selectOption("jw-font-24");
  await page.getByRole("button", { name: "글자색: 파랑", exact: true }).click();
  await expect(editable.locator("span.jw-color-blue.jw-font-24")).toHaveText(
    "가나다 가나다",
  );
  await page.getByRole("button", { name: "도구 더보기" }).click();
  await page
    .getByRole("button", { name: "찾기 / 바꾸기", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "찾기 / 바꾸기",
    exact: true,
  });
  await dialog.getByLabel("찾을 내용").fill("가나다");
  await dialog.getByLabel("바꿀 내용").fill("수정");
  await expect(dialog.getByRole("status")).toHaveText("2개 일치");
  await dialog.getByRole("button", { name: "모두 바꾸기" }).click();
  await dialog.getByRole("button", { name: "닫기" }).click();
  await expect(editable).toHaveText("수정 수정");
  await editable.focus();
  await page.keyboard.press("ControlOrMeta+Z");
  await expect(editable).toHaveText("가나다 가나다");
  await page.keyboard.press("ControlOrMeta+A");
  await menuAction(page, "목록", "체크리스트");
  await page.keyboard.press("Escape");
  await editable.getByRole("checkbox").first().check();
  await expect(editable.locator("li.jw-task-checked")).toHaveCount(1);
  await page.getByRole("button", { name: "도구 더보기" }).click();
  await page.getByRole("button", { name: "전체화면", exact: true }).click();
  await expect(page.locator(".jwsoft-editor-fullscreen")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(page.locator(".jwsoft-editor-fullscreen")).toHaveCount(0);
  const html = await page.evaluate(() => {
    const values = (window as any).__e2eStateUpdates.filter(
      (item: any) => typeof item.updates["form.content"] === "string",
    );
    return values[values.length - 1].updates["form.content"] as string;
  });
  expect(html).toContain("jw-task-checked");
  expect(html).not.toMatch(/style=|data-|<input|<button/);
  await page.screenshot({
    path: testInfo.outputPath("editor-writing-tools.png"),
    fullPage: true,
    animations: "disabled",
  });
});

test("table context controls and image resize are usable on the rendered editor", async ({
  page,
}, testInfo) => {
  await page.route("https://images.example/proof.png", (route) =>
    route.fulfill({
      contentType: "image/png",
      body: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
        "base64",
      ),
    }),
  );
  await mountEditor(
    page,
    "standard",
    false,
    false,
    false,
    false,
    '<table><tbody><tr><td colspan="1" rowspan="1"><p>셀</p></td><td colspan="1" rowspan="1"><p>둘</p></td></tr></tbody></table><p>이미지</p><figure class="jw-image jw-image-align-center jw-image-size-50"><img src="https://images.example/proof.png" alt="예시"></figure><p>끝</p>',
  );
  const editable = page.locator(".jwsoft-tiptap-editable");
  await editable.locator("td").first().click();
  const context = page.getByRole("toolbar", { name: "표 편집 도구" });
  await expect(context).toBeVisible();
  await context
    .getByLabel("셀 배경", { exact: true })
    .selectOption("jw-cell-blue");
  await context
    .getByLabel("세로 정렬", { exact: true })
    .selectOption("jw-cell-middle");
  await context
    .getByLabel("표 테두리", { exact: true })
    .selectOption("jw-table-borderless");
  await expect(editable.locator("td").first()).toHaveClass(/jw-cell-blue/);
  await expect(editable.locator("td").first()).toHaveClass(/jw-cell-middle/);
  await context.getByRole("button", { name: "행 추가", exact: true }).click();
  await expect(editable.locator("tr")).toHaveCount(2);
  await editable.locator("img").click();
  const handle = editable.getByRole("slider", { name: "이미지 너비 조절" });
  await expect(handle).toBeVisible();
  await handle.focus();
  await page.keyboard.press("ArrowRight");
  await expect(editable.locator("figure.jw-image")).toHaveClass(
    /jw-image-size-55/,
  );
  if (testInfo.project.name === "chromium-desktop") {
    await handle.scrollIntoViewIfNeeded();
    const bounds = await handle.boundingBox();
    const width = await editable.evaluate((element) => element.clientWidth);
    await page.mouse.move(
      bounds!.x + bounds!.width / 2,
      bounds!.y + bounds!.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      bounds!.x + bounds!.width / 2 - width * 0.1,
      bounds!.y + bounds!.height / 2,
      { steps: 6 },
    );
    await page.mouse.up();
    await expect(editable.locator("figure.jw-image")).toHaveClass(
      /jw-image-size-45/,
    );
  }
  await expect(editable.locator("[style]")).toHaveCount(0);
  await page.screenshot({
    path: testInfo.outputPath("editor-context-tools.png"),
    fullPage: true,
    animations: "disabled",
  });
});

test("closing a pending link preview modal does not insert late content", async ({
  page,
}) => {
  let requested = false;
  await page.route(
    "**/api/plugins/jwsoft-tiptap-editor/link-preview",
    async (route) => {
      requested = true;
      await new Promise((resolve) => setTimeout(resolve, 200));
      await route
        .fulfill({
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: {
              url: "https://example.com/post",
              title: "Late title",
              description: "",
              provider: "generic",
            },
          }),
        })
        .catch(() => {});
    },
  );
  await mountEditor(page, "standard", false, false, false, true);
  await insertTool(page, "링크 카드");
  const dialog = page.getByRole("dialog", { name: "링크 카드", exact: true });
  await dialog.getByLabel("HTTPS 주소").fill("https://example.com/post");
  await dialog.getByRole("button", { name: "링크 카드 삽입" }).click();
  await expect.poll(() => requested).toBe(true);
  await dialog.getByRole("button", { name: "닫기" }).click();
  await page.waitForTimeout(350);
  await expect(page.locator(".jwsoft-tiptap-editable .jw-card")).toHaveCount(0);
});
