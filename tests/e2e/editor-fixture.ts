import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { type Page } from "@playwright/test";

export const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

export const bundlePath = path.join(root, "dist/js/plugin.iife.js");

export const pluginVersion: string = JSON.parse(
  fs.readFileSync(path.join(root, "plugin.json"), "utf8"),
).version;

export function recordBrowserEvidence(
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
        status: process.env.JW_EXECUTION_RUN_ID ? "pass" : "unverified",
        executionRunId: process.env.JW_EXECUTION_RUN_ID,
        sourceFingerprint: process.env.JW_EXECUTION_FINGERPRINT,
        execution: "test-results/harness/browser-ui.json",
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

export async function mountEditor(
  page: Page,
  toolbar = "standard",
  imageUpload = false,
  mediaEmbed = false,
  videoUpload = false,
  smartCards = false,
  content = "<p>선택 영역 테스트</p>",
  origin = "http://jwsoft.test",
  hostForm = false,
  richEmbeds = false,
): Promise<void> {
  await page.route(`${origin}/`, (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<!doctype html>
        <html lang="ko">
          <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
          <body><main>${hostForm ? '<form><input name="title" aria-label="제목">' : ""}<div id="jwsoft-tiptap-content" class="jwsoft-tiptap-wrapper"></div>${hostForm ? '<button type="button">등록</button></form>' : ""}</main></body>
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
      withRichEmbeds,
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
            socialCards: withSmartCards,
            xEmbed: withRichEmbeds,
            facebookEmbed: withRichEmbeds,
            instagramEmbed: withRichEmbeds,
            tiktokEmbed: withRichEmbeds,
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
      withRichEmbeds: richEmbeds,
    },
  );
}

export async function insertTool(page: Page, name: string) {
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

export async function menuAction(page: Page, name: string, action: string) {
  const panel = page.getByRole("dialog", { name, exact: true });
  if (!(await panel.isVisible()))
    await page.getByRole("button", { name, exact: true }).click();
  await panel.getByRole("button", { name: action, exact: true }).click();
}
