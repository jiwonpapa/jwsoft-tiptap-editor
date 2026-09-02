import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import {
  root,
  recordBrowserEvidence,
  mountEditor,
  insertTool,
} from "./editor-fixture";

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

test("media URL displays the same immediate responsive player in editor and content", async ({
  page,
}) => {
  await mountEditor(page, "standard", false, true);
  await insertTool(page, "동영상");
  const dialog = page.getByRole("dialog", { name: "동영상" });
  await dialog.getByLabel("동영상 URL").fill("https://youtu.be/dQw4w9WgXcQ");
  await dialog.getByRole("button", { name: "동영상 삽입" }).click();

  const media = page.locator(".jwsoft-tiptap-editable figure.jw-media-youtube");
  await expect(media).toBeVisible();
  await expect(media.locator("a.jw-media-original")).toHaveAttribute(
    "href",
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  );
  await expect(media.locator("iframe")).toHaveAttribute("src", /autoplay=0/);
  await expect(media.locator(".jw-media-load")).toHaveCount(0);

  await page.evaluate(async () => {
    const runtime = window as typeof window & {
      __e2eHandlers: Record<
        string,
        (action: Record<string, unknown>, context: unknown) => unknown
      >;
      __e2eStateUpdates: Array<{ updates: Record<string, unknown> }>;
    };
    const output = document.createElement("div");
    output.className = "jwsoft-tiptap-content";
    const updates = runtime.__e2eStateUpdates.filter(
      ({ updates }) => typeof updates["form.content"] === "string",
    );
    const saved = updates[updates.length - 1].updates["form.content"] as string;
    if (/<(?:iframe|video|button|svg)\b|jwsoft-media-node/.test(saved))
      throw new Error("Presentation DOM leaked into canonical HTML");
    output.innerHTML = saved;
    document.body.appendChild(output);
    await runtime.__e2eHandlers["jwsoft-tiptap-editor.injectContentStyles"](
      { params: { externalMediaLoadMode: "immediate", mediaAutoplay: false } },
      undefined,
    );
    await Promise.resolve();
  });
  const output = page.locator(".jwsoft-tiptap-content figure.jw-media");
  await expect(output.locator("iframe")).toHaveAttribute(
    "src",
    /youtube-nocookie\.com\/embed\/dQw4w9WgXcQ/,
  );
  const box = await output.boundingBox();
  expect((box?.width ?? 0) / (box?.height ?? 1)).toBeCloseTo(16 / 9, 1);
  expect(await media.locator(".jw-media-surface").innerHTML()).toBe(
    await output.locator(".jw-media-surface").innerHTML(),
  );
  const editorBox = await media.boundingBox();
  expect((editorBox?.width ?? 0) / (editorBox?.height ?? 1)).toBeCloseTo(
    16 / 9,
    1,
  );
  await page
    .getByRole("button", { name: "동영상 선택·이동", exact: true })
    .click();
  await expect(page.locator(".jwsoft-media-node")).toHaveClass(
    /ProseMirror-selectednode/,
  );
  await page.getByRole("button", { name: "동영상 삭제", exact: true }).click();
  await expect(media).toHaveCount(0);
});

test("portrait MP4 keeps its decoded ratio responsively in editor and content", async ({
  page,
}) => {
  const playable = fs.readFileSync(
    path.join(root, "tests/fixtures/playable-portrait.mp4"),
  );
  await page.route(
    "http://jwsoft.test/api/plugins/jwsoft-tiptap-editor/media/abcdef123456",
    (route) => route.fulfill({ contentType: "video/mp4", body: playable }),
  );
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
              chunk_size: playable.length,
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
        expect(request.postDataBuffer()?.length).toBeGreaterThan(
          playable.length,
        );
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
    buffer: playable,
  });
  await dialog.getByRole("button", { name: "업로드 후 삽입" }).click();

  const media = page.locator(".jwsoft-tiptap-editable figure.jw-media-mp4");
  await expect(media.locator("a.jw-media-original")).toHaveText(
    "proof.mp4 · 원본 열기",
  );
  await expect(media.locator("a.jw-media-original")).toHaveAttribute(
    "href",
    "/api/plugins/jwsoft-tiptap-editor/media/abcdef123456",
  );
  const video = media.locator("video");
  await expect(video).toHaveAttribute("controls", "");
  await expect
    .poll(() => video.evaluate((element: HTMLVideoElement) => element.duration))
    .toBe(3);
  await expect
    .poll(() =>
      video.evaluate((element: HTMLVideoElement) => ({
        width: element.videoWidth,
        height: element.videoHeight,
      })),
    )
    .toEqual({ width: 180, height: 320 });
  await expect(media).toHaveClass(/jw-media-intrinsic/);
  const editorBox = await media.boundingBox();
  expect((editorBox?.width ?? 0) / (editorBox?.height ?? 1)).toBeCloseTo(
    180 / 320,
    2,
  );
  const editorLayout = await media.evaluate((element) => ({
    figureWidth: element.getBoundingClientRect().width,
    editorWidth:
      element.closest(".jwsoft-tiptap-editable")?.getBoundingClientRect()
        .width ?? 0,
    pageWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));
  expect(editorLayout.figureWidth).toBeLessThanOrEqual(
    editorLayout.editorWidth,
  );
  expect(editorLayout.figureWidth).toBeLessThanOrEqual(416);
  expect(editorLayout.pageWidth).toBeLessThanOrEqual(
    editorLayout.viewportWidth,
  );
  await video.evaluate((element: HTMLVideoElement) => element.play());
  await expect
    .poll(() =>
      video.evaluate((element: HTMLVideoElement) => element.currentTime),
    )
    .toBeGreaterThan(0);
  await video.evaluate((element: HTMLVideoElement) => element.pause());
  await expect(
    page.locator(".jwsoft-tiptap-editable .jw-media-load"),
  ).toHaveCount(0);

  await expect
    .poll(() =>
      page.evaluate(() => {
        const runtime = window as typeof window & {
          __e2eStateUpdates: Array<{ updates: Record<string, unknown> }>;
        };
        return runtime.__e2eStateUpdates.some(
          ({ updates }) =>
            typeof updates["form.content"] === "string" &&
            updates["form.content"].includes("proof.mp4"),
        );
      }),
    )
    .toBe(true);
  await page.evaluate(async () => {
    const runtime = window as typeof window & {
      __e2eHandlers: Record<
        string,
        (action: Record<string, unknown>, context: unknown) => unknown
      >;
      __e2eStateUpdates: Array<{ updates: Record<string, unknown> }>;
    };
    const saved = [...runtime.__e2eStateUpdates]
      .reverse()
      .find(({ updates }) =>
        String(updates["form.content"] ?? "").includes("proof.mp4"),
      )?.updates["form.content"];
    if (typeof saved !== "string")
      throw new Error("MP4 canonical HTML missing");
    if (/<(?:video|iframe)\b|jw-media-(?:intrinsic|fit-)|style=/u.test(saved))
      throw new Error(
        "Presentation-only MP4 layout leaked into canonical HTML",
      );
    const output = document.createElement("div");
    output.className = "jwsoft-tiptap-content";
    output.innerHTML = saved;
    document.body.append(output);
    await runtime.__e2eHandlers["jwsoft-tiptap-editor.injectContentStyles"](
      { params: { externalMediaLoadMode: "immediate", mediaAutoplay: false } },
      undefined,
    );
  });
  const output = page.locator(".jwsoft-tiptap-content figure.jw-media-mp4");
  await expect(output).toHaveClass(/jw-media-intrinsic/);
  const outputBox = await output.boundingBox();
  expect((outputBox?.width ?? 0) / (outputBox?.height ?? 1)).toBeCloseTo(
    180 / 320,
    2,
  );
  const outputLayout = await output.evaluate((element) => ({
    figureWidth: element.getBoundingClientRect().width,
    contentWidth:
      element.closest(".jwsoft-tiptap-content")?.getBoundingClientRect()
        .width ?? 0,
    pageWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));
  expect(outputLayout.figureWidth).toBeLessThanOrEqual(
    outputLayout.contentWidth,
  );
  expect(outputLayout.figureWidth).toBeLessThanOrEqual(416);
  expect(outputLayout.pageWidth).toBeLessThanOrEqual(
    outputLayout.viewportWidth,
  );
  expect(partRequests).toBe(1);
});
