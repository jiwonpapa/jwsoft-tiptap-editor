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
  videoUpload = false,
  smartCards = false,
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
    async ({
      profile,
      withImageUpload,
      withMediaEmbed,
      withVideoUpload,
      withSmartCards,
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
            content: "<p>선택 영역 테스트</p>",
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
  await page.getByRole("button", { name: "동영상" }).click();
  const dialog = page.getByRole("dialog", { name: "동영상" });
  await dialog.getByLabel("MP4 파일").setInputFiles({
    name: "proof.mp4",
    mimeType: "video/mp4",
    buffer: Buffer.from([
      0, 0, 0, 24, 102, 116, 121, 112, 105, 115, 111, 109, 0, 0, 0, 0, 105, 115,
      111, 109, 109, 112, 52, 49, 0, 0, 0, 8, 109, 100, 97, 116,
    ]),
  });
  await dialog.getByRole("button", { name: "동영상 삽입" }).click();

  const media = page.locator(".jwsoft-tiptap-editable figure.jw-media-mp4");
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
  await page.getByRole("button", { name: "링크 카드" }).click();
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
