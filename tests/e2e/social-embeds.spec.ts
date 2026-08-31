import { test, expect } from "@playwright/test";
import path from "node:path";
const bundle = path.resolve("dist/js/plugin.iife.js");
const xUrl = "https://x.com/Interior/status/463440424141459456";
const fbUrl = "https://www.facebook.com/ISS/posts/1194948136005111";
const card = (provider: string, url: string) =>
  `<figure class="jw-card jw-card-${provider}"><a class="jw-card-link" href="${url}" target="_blank" rel="noopener noreferrer" title="${provider}"><strong>${provider} post</strong></a></figure>`;

async function setup(
  page: import("@playwright/test").Page,
  options: {
    off?: boolean;
    click?: boolean;
    failure?: boolean;
    live?: boolean;
  } = {},
) {
  let sdkRequests = 0;
  if (!options.live) {
    await page.route("https://platform.twitter.com/**", (route) => {
      sdkRequests++;
      return options.failure
        ? route.abort()
        : route.fulfill({
            contentType: "application/javascript",
            body: `window.twttr={widgets:{createTweet:async(id,target)=>{const post=document.createElement('article');post.textContent='X full post with body and media';post.style.height='450px';target.append(post);return post}}};`,
          });
    });
    await page.route("https://connect.facebook.net/**", (route) => {
      sdkRequests++;
      return options.failure
        ? route.abort()
        : route.fulfill({
            contentType: "application/javascript",
            body: `window.FB={init(){},XFBML:{parse(target,done){target.textContent='Facebook full public post';target.style.height='650px';done()}}};`,
          });
    });
  }
  await page.route("http://social-test.test/", (route) =>
    route.fulfill({
      contentType: "text/html; charset=utf-8",
      body: `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><div id="jwsoft-tiptap-content"></div><div class="jwsoft-tiptap-content" id="view">${card("x", xUrl)}${card("facebook", fbUrl)}</div>`,
    }),
  );
  await page.goto("http://social-test.test/");
  await page.evaluate(() => {
    Object.assign(window, {
      handlers: {},
      updates: [],
      G7Core: {
        locale: { current: () => "ko", supported: () => ["ko"] },
        state: {
          getLocal: () => ({ form: { content_mode: "html" } }),
          setLocal: (value: unknown) => (window as any).updates.push(value),
        },
        getActionDispatcher: () => ({
          registerHandler: (name: string, fn: unknown) => {
            (window as any).handlers[name] = fn;
          },
        }),
      },
    });
  });
  await page.addScriptTag({ path: bundle });
  await page.evaluate(
    async ({ html, off, click }) => {
      const params = {
        name: "content",
        content: html,
        smartCards: true,
        socialCards: true,
        xEmbed: !off,
        facebookEmbed: !off,
        externalMediaLoadMode: click ? "click" : "immediate",
      };
      const handlers = (window as any).handlers;
      await handlers["jwsoft-tiptap-editor.initEditor"]({ params });
      handlers["jwsoft-tiptap-editor.injectContentStyles"]({ params });
    },
    {
      html: card("x", xUrl) + card("facebook", fbUrl),
      off: options.off,
      click: options.click,
    },
  );
  return { requests: () => sdkRequests };
}

test("official whitelist display is shared by editing/viewing, responsive, and never serialized", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const network = await setup(page);
  await expect(
    page.locator('.jw-social-surface[data-state="rendered"]'),
  ).toHaveCount(4);
  expect(network.requests()).toBe(4);
  await expect(
    page
      .frameLocator("iframe.jw-social-frame")
      .nth(0)
      .getByText("X full post with body and media"),
  ).toBeVisible();
  await expect(
    page
      .frameLocator("iframe.jw-social-frame")
      .nth(1)
      .getByText("Facebook full public post"),
  ).toBeVisible();
  const size = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(size.scroll).toBeLessThanOrEqual(size.client);
  // A normal document change serializes the ProseMirror node, not the SDK DOM.
  await page
    .getByRole("button", { name: "카드 삭제", exact: true })
    .first()
    .click();
  await expect(
    page.locator(".jwsoft-tiptap-editable iframe.jw-social-frame"),
  ).toHaveCount(1);
  const values = await page.evaluate(() =>
    JSON.stringify((window as any).updates),
  );
  expect(values).not.toMatch(
    /<iframe|<script|srcdoc|full public post|full post with body/,
  );
  expect(values).toContain("jw-card-facebook");
  await page.evaluate(() => {
    (window as any).handlers["jwsoft-tiptap-editor.injectContentStyles"]({
      params: { smartCards: false },
    });
  });
  await expect(page.locator("#view iframe")).toHaveCount(0);
  await expect(page.locator("#view a.jw-card-link")).toHaveCount(2);
  expect(errors).toEqual([]);
});

test("OFF has no external execution; click mode defers it and failed SDK has a small retry state", async ({
  page,
}) => {
  const off = await setup(page, { off: true });
  await expect(page.locator("iframe")).toHaveCount(0);
  expect(off.requests()).toBe(0);
  const network = await setup(page, { click: true, failure: true });
  await expect(page.locator("iframe")).toHaveCount(0);
  expect(network.requests()).toBe(0);
  await page
    .getByRole("button", { name: "X 게시물 불러오기", exact: true })
    .first()
    .click();
  await expect(
    page.locator('.jw-social-surface[data-state="error"]'),
  ).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "다시 시도", exact: true }),
  ).toBeVisible();
  await expect(page.locator("iframe")).toHaveCount(0);
  expect(network.requests()).toBe(1);
  await expect(
    page.getByRole("link", { name: "X · 원문 열기", exact: true }).first(),
  ).toHaveAttribute("href", xUrl);
});

test("live official providers render in both surfaces", async ({
  page,
}, testInfo) => {
  test.skip(
    process.env.JWSOFT_LIVE_SOCIAL !== "1",
    "Opt-in real provider verification; deterministic tests do not claim external availability.",
  );
  test.setTimeout(60000);
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  await setup(page, { live: true });
  await expect(
    page.locator('.jw-social-surface[data-state="rendered"]'),
  ).toHaveCount(4, { timeout: 30000 });
  for (const [index, frame] of page
    .frames()
    .filter((frame) =>
      frame.url().startsWith("https://platform.twitter.com/embed/Tweet.html"),
    )
    .entries()) {
    const surface = page
      .locator("iframe.jw-social-frame")
      .nth(index === 0 ? 0 : 2);
    await surface.scrollIntoViewIfNeeded();
    await expect
      .poll(
        async () =>
          frame
            .locator("img[src]")
            .evaluateAll(
              (images) =>
                images.filter(
                  (img) =>
                    (img as HTMLImageElement).complete &&
                    (img as HTMLImageElement).naturalWidth > 0,
                ).length,
            ),
        { timeout: 10000 },
      )
      .toBeGreaterThan(0);
  }
  await page.locator("#view").scrollIntoViewIfNeeded();
  await page.screenshot({
    path: testInfo.outputPath("official-social-view.png"),
    fullPage: false,
  });
  await page.locator("#jwsoft-tiptap-content").scrollIntoViewIfNeeded();
  await page.screenshot({
    path: testInfo.outputPath("official-social-editor.png"),
    fullPage: false,
  });
  await testInfo.attach("provider-console-errors", {
    body: JSON.stringify(consoleErrors, null, 2),
    contentType: "application/json",
  });
  for (const frame of page
    .frames()
    .filter(
      (frame) =>
        frame
          .url()
          .startsWith("https://www.facebook.com/v23.0/plugins/post.php") ||
        frame.url().startsWith("https://platform.twitter.com/embed/Tweet.html"),
    )) {
    const body = await frame.locator("body").innerText();
    await testInfo.attach(
      frame.url().includes("facebook")
        ? "facebook-visible-text"
        : "x-visible-text",
      { body, contentType: "text/plain" },
    );
    expect(body).not.toMatch(
      /no longer available|content isn't available|Sorry, something went wrong|not available right now/i,
    );
  }
  const frames = page.frames().map((frame) => frame.url());
  expect(
    frames.some((url) =>
      url.startsWith("https://platform.twitter.com/embed/Tweet.html"),
    ),
  ).toBe(true);
  expect(
    frames.some((url) =>
      url.startsWith("https://www.facebook.com/v23.0/plugins/post.php"),
    ),
  ).toBe(true);
});
