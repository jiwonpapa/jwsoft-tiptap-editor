import { expect, test } from "@playwright/test";
import { mountEditor, insertTool } from "./editor-fixture";

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
