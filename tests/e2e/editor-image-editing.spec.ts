import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import {
  imageEditorBundlePath,
  insertTool,
  mountEditor,
  recordBrowserEvidence,
  root,
} from "./editor-fixture";

const originalUrl = "/api/plugins/jwsoft-tiptap-editor/images/abcdef123456";
const editedUrl = "/api/plugins/jwsoft-tiptap-editor/images/fedcba654321";
const fixtureImage = fs.readFileSync(
  path.join(root, "docs/assets/jw-editor-intro.png"),
);

test("optional image editor lazy-loads and replaces only the selected image source", async ({
  page,
}, testInfo) => {
  let vendorRequests = 0;
  let uploads = 0;
  await page.addInitScript(() => {
    window.__JWSoftImageEditorAssetBase = "http://jwsoft.test/assets/";
  });
  await page.route(
    "http://jwsoft.test/assets/image-editor.iife.js",
    async (route) => {
      vendorRequests += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/javascript",
        path: imageEditorBundlePath,
      });
    },
  );
  await page.route(
    "http://jwsoft.test/api/plugins/jwsoft-tiptap-editor/images/*",
    (route) =>
      route.fulfill({
        status: 200,
        contentType: "image/png",
        body: fixtureImage,
      }),
  );
  await page.route(
    "http://jwsoft.test/api/plugins/jwsoft-tiptap-editor/upload",
    async (route) => {
      uploads += 1;
      expect(route.request().method()).toBe("POST");
      expect(route.request().postDataBuffer()?.toString()).toContain(
        "-edited-",
      );
      if (uploads > 1) {
        await route.fulfill({
          status: 422,
          contentType: "application/json",
          body: JSON.stringify({ success: false, message: "업로드 거부" }),
        });
        return;
      }
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: { download_url: editedUrl, original_name: "edited.png" },
        }),
      });
    },
  );

  await mountEditor(
    page,
    "standard",
    true,
    false,
    false,
    false,
    `<figure class="jw-image jw-image-align-right jw-image-size-50"><img src="${originalUrl}" alt="보존 대체문구" title="보존 제목"><figcaption>보존 캡션</figcaption></figure><p>본문</p>`,
    "http://jwsoft.test",
    false,
    false,
    true,
  );
  expect(vendorRequests).toBe(0);
  await expect(
    page.locator('script[data-jwsoft-image-editor="vendor"]'),
  ).toHaveCount(0);

  const figure = page.locator(".jwsoft-tiptap-editable figure.jw-image");
  await figure.locator("img").click({ position: { x: 8, y: 8 } });
  await insertTool(page, "이미지 편집");
  const dialog = page.getByRole("dialog", { name: "이미지 편집", exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".FIE_root canvas").first()).toBeVisible({
    timeout: 15_000,
  });
  expect(vendorRequests).toBe(1);
  const layout = await dialog.evaluate((element) => ({
    width: element.getBoundingClientRect().width,
    viewport: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
  }));
  expect(layout.width).toBeLessThanOrEqual(layout.viewport);
  expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewport);
  await page.screenshot({
    path: testInfo.outputPath(`image-editor-${testInfo.project.name}.png`),
    animations: "disabled",
  });

  await dialog
    .getByRole("button", { name: "편집본 저장", exact: true })
    .click();
  await expect(dialog).toBeHidden({ timeout: 15_000 });
  expect(uploads).toBe(1);
  const image = figure.locator("img");
  await expect(image).toHaveAttribute("src", editedUrl);
  await expect(image).toHaveAttribute("alt", "보존 대체문구");
  await expect(image).toHaveAttribute("title", "보존 제목");
  await expect(figure.locator("figcaption")).toHaveText("보존 캡션");
  await expect(figure).toHaveClass(/jw-image-align-right/);
  await expect(figure).toHaveClass(/jw-image-size-50/);
  await expect(
    page.locator('.jwsoft-tiptap-editable [style]:not([style=""])'),
  ).toHaveCount(0);
  const canonical = await page.evaluate(() => {
    const updates = window.__e2eStateUpdates.filter(
      (item) => typeof item.updates["form.content"] === "string",
    );
    return updates[updates.length - 1]?.updates["form.content"] as string;
  });
  expect(canonical).toContain(editedUrl);
  expect(canonical).not.toMatch(/\sstyle=|\sdata-/u);

  await image.click({ position: { x: 8, y: 8 } });
  await insertTool(page, "이미지 편집");
  await expect(dialog.locator(".FIE_root canvas").first()).toBeVisible();
  await dialog
    .getByRole("button", { name: "편집본 저장", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toHaveText("업로드 거부");
  await expect(dialog).toBeVisible();
  await expect(image).toHaveAttribute("src", editedUrl);
  await dialog.getByRole("button", { name: "취소", exact: true }).click();
  expect(uploads).toBe(2);
  recordBrowserEvidence(
    `editor-image-editing-${testInfo.project.name}.json`,
    testInfo.project.name,
    {
      vendorRequests,
      uploads,
      mobile: testInfo.project.name === "chromium-mobile",
      dialogLayout: layout,
      sourceReplaced: (await image.getAttribute("src")) === editedUrl,
      attributesPreserved: true,
      uploadFailurePreservedSource: true,
    },
  );
});

test("image editor stays absent when its setting is off", async ({ page }) => {
  await mountEditor(
    page,
    "standard",
    true,
    false,
    false,
    false,
    `<figure class="jw-image jw-image-align-center jw-image-size-100"><img src="${originalUrl}" alt="원본"></figure>`,
  );
  await expect(
    page.getByRole("button", { name: "이미지 편집", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.locator('script[data-jwsoft-image-editor="vendor"]'),
  ).toHaveCount(0);
});
