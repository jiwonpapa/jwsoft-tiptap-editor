import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, type Page, test } from "@playwright/test";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const bundlePath = path.join(root, "dist/js/plugin.iife.js");

async function mountEditor(
  page: Page,
  toolbar = "standard",
  imageUpload = false,
  mediaEmbed = false,
): Promise<void> {
  await page.route("http://jwsoft.test/", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<!doctype html>
        <html lang="ko">
          <head><meta name="viewport" content="width=device-width, initial-scale=1"></head>
          <body><main><div id="jwsoft-tiptap-content" class="jwsoft-tiptap-wrapper"></div></main></body>
        </html>`,
    }),
  );
  await page.goto("http://jwsoft.test/");
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
  await page.evaluate(
    async ({ profile, withImageUpload, withMediaEmbed }) => {
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
            imageUpload: withImageUpload,
            mediaEmbed: withMediaEmbed,
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
    },
  );
}

test("desktop toolbar keeps selection commands and keyboard focus usable", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desktop");
  await mountEditor(page);
  const editable = page.locator(".jwsoft-tiptap-editable");
  const bold = page.getByRole("button", { name: /굵게/ });
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
  await page.getByRole("button", { name: "이미지" }).click();
  const dialog = page.getByRole("dialog", { name: "이미지" });
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

test("inline image upload reports completion and inserts the canonical URL", async ({
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
  await mountEditor(page, "standard", true);
  await page.getByRole("button", { name: "이미지" }).click();
  const dialog = page.getByRole("dialog", { name: "이미지" });
  await dialog.getByLabel("이미지 파일").setInputFiles({
    name: "proof.png",
    mimeType: "image/png",
    buffer: Buffer.from("browser-upload-proof"),
  });
  await dialog.getByLabel("대체 텍스트").fill("업로드 증빙");
  await dialog.getByRole("button", { name: "이미지 삽입" }).click();

  const image = page.locator(".jwsoft-tiptap-editable img");
  await expect(image).toHaveAttribute(
    "src",
    "/api/plugins/jwsoft-tiptap-editor/images/abcdef123456",
  );
  await expect(image).toHaveAttribute("alt", "업로드 증빙");
});

test("media URL creates safe canonical HTML and a click-to-load responsive player", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desktop");
  await mountEditor(page, "standard", false, true);
  await page.getByRole("button", { name: "동영상" }).click();
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
