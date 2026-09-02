import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { fallback, mobileAndLocale } from "./auxiliary.ts";
import { boardSurface } from "./boards.ts";
import { object, text } from "./context.ts";
import type { Context, Observation } from "./context.ts";
import { media, urls } from "./media.ts";
import { pageSurface } from "./pages.ts";
import { productSurface } from "./products.ts";
import { emptyTitleEnter, invalidImages, legacyConsent } from "./validation.ts";

const config = object(JSON.parse(fs.readFileSync(process.argv[2], "utf8")));
const mode = process.argv[3];
assert(mode === "surfaces" || mode === "legacy");
const base = text(config.base);
assert(/^http:\/\/127\.0\.0\.1:\d+$/.test(base));
const output = text(config.output);
const credentials = object(
  JSON.parse(fs.readFileSync(path.join(output, "account.json"), "utf8")),
);
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  userAgent: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${browser.version()} Safari/537.36`,
});
const page = await context.newPage();
page.setDefaultTimeout(20000);
const c: Context = {
  page,
  base,
  output,
  runId: text(config.runId),
  timings: [],
};
const cases: Observation[] = [];
const observations: Observation = {};
const report = path.join(output, `${mode}.json`);

async function test(
  id: string,
  action: () => Promise<Observation>,
): Promise<void> {
  const startedAt = new Date().toISOString();
  const data = await action();
  observations[id] = data;
  cases.push({
    id,
    status: "passed",
    startedAt,
    finishedAt: new Date().toISOString(),
  });
  console.log(`[g7-browser] passed: ${id}`);
}

try {
  await page.goto(base + "/admin/login");
  await page
    .getByRole("textbox", { name: "이메일", exact: true })
    .fill(text(credentials.email));
  await page
    .getByRole("textbox", { name: "비밀번호", exact: true })
    .fill(text(credentials.password));
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await page.waitForURL("**/admin/dashboard");
  if (mode === "surfaces") {
    await test("public-board", () => boardSurface(c, false));
    await test("admin-board", () => boardSurface(c, true));
    await test("page", () => pageSurface(c));
    await test("ecommerce", () => productSurface(c));
    await test("invalid-images", () => invalidImages(c));
    await test("mp4", () => media(c));
    await test("urls", () => urls(c));
    await test("empty-title-enter", () => emptyTitleEnter(c));
    await test("mobile-dark-i18n", () => mobileAndLocale(c));
    await test("fallback", () => fallback(c));
  } else {
    await test("legacy-consent", () => legacyConsent(c, `JW-${c.runId}`));
  }
  fs.writeFileSync(
    report,
    JSON.stringify(
      {
        status: "pass",
        runId: c.runId,
        cases,
        observations,
        timings: c.timings,
        browser: `headless Chrome ${browser.version()}`,
      },
      null,
      2,
    ),
  );
} catch (error) {
  await page.screenshot({ path: path.join(output, `${mode}-failure.png`) });
  fs.writeFileSync(
    report,
    JSON.stringify(
      {
        status: "failed",
        runId: c.runId,
        cases,
        observations,
        error: String(error),
      },
      null,
      2,
    ),
  );
  throw error;
} finally {
  await context.close();
  await browser.close();
}
