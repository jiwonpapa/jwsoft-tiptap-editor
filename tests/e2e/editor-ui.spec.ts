import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, type Page, test } from "@playwright/test";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const bundlePath = path.join(root, "dist/js/plugin.iife.js");

async function mountEditor(page: Page, toolbar = "standard"): Promise<void> {
  await page.setContent(`
    <!doctype html>
    <html lang="ko">
      <head><meta name="viewport" content="width=device-width, initial-scale=1"></head>
      <body><main><div id="jwsoft-tiptap-content" class="jwsoft-tiptap-wrapper"></div></main></body>
    </html>
  `);
  await page.evaluate(() => {
    const handlers: Record<string, (...args: unknown[]) => unknown> = {};
    const dispatcher = {
      registerHandler(name: string, handler: (...args: unknown[]) => unknown) {
        handlers[name] = handler;
      },
    };
    Object.assign(window, {
      __e2eHandlers: handlers,
      G7Core: {
        locale: { current: () => "ko", supported: () => ["ko"] },
        state: {
          getLocal: () => ({ form: { content_mode: "html" } }),
          setLocal: () => undefined,
        },
        getActionDispatcher: () => dispatcher,
      },
    });
  });
  await page.addScriptTag({ path: bundlePath });
  await page.evaluate(async (profile) => {
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
          content: "<p>선택 영역 테스트</p>",
          height: 280,
          toolbar: profile,
        },
      },
      undefined,
    );
  }, toolbar);
}

test("desktop toolbar keeps selection commands and keyboard focus usable", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desktop");
  await mountEditor(page);
  const editable = page.locator(".jwsoft-tiptap-editable");
  await editable.click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.getByRole("button", { name: /굵게/ }).click();
  await expect(editable.locator("strong")).toHaveText("선택 영역 테스트");

  const bold = page.getByRole("button", { name: /굵게/ });
  await bold.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("button", { name: /기울임/ })).toBeFocused();

  await page.screenshot({
    path: testInfo.outputPath("editor-toolbar-desktop.png"),
    fullPage: true,
  });
});

test("mobile toolbar scrolls without widening the page and keeps dialogs visible", async ({
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
  expect(metrics.scrollWidth).toBeGreaterThan(metrics.clientWidth);
  expect(metrics.pageWidth).toBeLessThanOrEqual(metrics.viewportWidth);

  const boldBox = await page
    .getByRole("button", { name: /굵게/ })
    .boundingBox();
  expect(boldBox?.height).toBeGreaterThanOrEqual(40);
  await page.getByRole("button", { name: "이미지 URL" }).click();
  const dialog = page.getByRole("dialog", { name: "이미지 URL" });
  await expect(dialog).toBeVisible();
  const dialogBox = await dialog.boundingBox();
  expect(dialogBox?.x).toBeGreaterThanOrEqual(0);
  expect((dialogBox?.x ?? 0) + (dialogBox?.width ?? 0)).toBeLessThanOrEqual(
    await page.evaluate(() => window.innerWidth),
  );

  await page.screenshot({
    path: testInfo.outputPath("editor-toolbar-mobile.png"),
    fullPage: true,
  });
});
