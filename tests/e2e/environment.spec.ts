import { expect, test } from "@playwright/test";

test("G7 integration environment is explicitly enabled", async ({ page }) => {
  test.skip(
    process.env.JW_EDITOR_E2E !== "1",
    "Set JW_EDITOR_E2E=1 after installing the plugin into a dedicated G7 host.",
  );
  await page.goto("/");
  await expect(page.locator("body")).toBeVisible();
});
