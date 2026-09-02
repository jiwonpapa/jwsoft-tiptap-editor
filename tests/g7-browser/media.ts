import assert from "node:assert/strict";
import path from "node:path";
import {
  boardEdit,
  boardShow,
  createBoardPost,
  saveBoardPost,
} from "./boards.ts";
import { canonical, editor, openEditor, positive, shot } from "./context.ts";
import type { Context, Observation } from "./context.ts";

async function playback(c: Context, selector: string): Promise<Observation> {
  const video = c.page.locator(selector).first();
  await video.waitFor();
  await c.page.waitForFunction((query) => {
    const node = document.querySelector<HTMLVideoElement>(query);
    return node && (node.readyState > 0 || node.error !== null);
  }, selector);
  await video.evaluate(async (node: HTMLVideoElement) => {
    if (node.error) throw new Error("Video metadata failed");
    node.muted = true;
    await node.play();
  });
  await c.page.waitForFunction((query) => {
    const node = document.querySelector<HTMLVideoElement>(query);
    return node && node.currentTime > 0.2;
  }, selector);
  const data = await video.evaluate((node: HTMLVideoElement) => {
    node.pause();
    const box = node.getBoundingClientRect();
    return {
      controls: node.controls,
      duration: node.duration,
      timeAfter: node.currentTime,
      width: box.width,
      height: box.height,
      intrinsicWidth: node.videoWidth,
      intrinsicHeight: node.videoHeight,
      source: node.currentSrc,
    };
  });
  assert(data.controls && data.duration > 0 && data.timeAfter > 0.2);
  assert(
    Math.abs(
      data.width / data.height - data.intrinsicWidth / data.intrinsicHeight,
    ) < 0.01,
  );
  return data;
}

export async function media(c: Context): Promise<Observation> {
  await createBoardPost(c, false, "MP4");
  await editor(c).fill("jw-editor playable portrait fixture");
  await editor(c).press("Enter");
  await c.page.getByRole("button", { name: "동영상", exact: true }).click();
  const dialog = c.page.getByRole("dialog", { name: "동영상", exact: true });
  await dialog.getByRole("tab", { name: "MP4 업로드", exact: true }).click();
  await dialog
    .getByLabel("MP4 파일", { exact: true })
    .setInputFiles(path.join(c.output, "fixture.mp4"));
  await dialog
    .getByRole("button", { name: "업로드 후 삽입", exact: true })
    .click();
  await dialog.waitFor({ state: "hidden" });
  const editing = await playback(c, ".tiptap video");
  const screenshots = [await shot(c, "mp4-editor")];
  const created = await saveBoardPost(c, false);
  const id = positive(created.id);
  const html = canonical(created.content);
  assert(html.includes(".mp4") && html.includes("jw-media-mp4"));
  await c.page.goto(c.base + boardShow(false, id));
  const view = await playback(c, ".jwsoft-tiptap-content video");
  screenshots.push(await shot(c, "mp4-view"));
  const range = await c.page.request.get(String(view.source), {
    headers: { Range: "bytes=0-1023" },
  });
  assert.equal(range.status(), 206);
  await c.page.setViewportSize({ width: 390, height: 844 });
  await c.page.reload();
  await playback(c, ".jwsoft-tiptap-content video");
  screenshots.push(await shot(c, "mp4-mobile"));
  await c.page.setViewportSize({ width: 1280, height: 900 });
  await openEditor(c, boardEdit(false, id));
  await playback(c, ".tiptap video");
  return {
    postId: id,
    filename: "fixture.mp4",
    controls: view.controls,
    duration: view.duration,
    timeBefore: 0,
    timeAfter: view.timeAfter,
    rangeStatus: range.status(),
    editing,
    view,
    screenshots,
  };
}

export async function urls(c: Context): Promise<Observation> {
  await createBoardPost(c, false, "URLs");
  await editor(c).fill("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  await editor(c).press("Enter");
  await editor(c).locator("iframe").waitFor();
  const typedYoutubeCount = await editor(c)
    .locator(".jw-media-youtube")
    .count();
  assert.equal(typedYoutubeCount, 1);
  await editor(c).locator("p").last().click();
  await c.page.keyboard.insertText(
    "https://x.com/Interior/status/463440424141459456",
  );
  await c.page.keyboard.press("Enter");
  await editor(c).locator(".jw-card-x").waitFor({ timeout: 60000 });
  assert.equal(await editor(c).locator(".jw-card-x").count(), 1);
  await editor(c).locator("p").last().click();
  const failed = "https://example.invalid/jw-editor-preview-failure";
  await c.page.keyboard.insertText(failed);
  await c.page.keyboard.press("Enter");
  await c.page.getByText(/미리보기를 가져오지 못해 원래 URL을 유지/).waitFor();
  const created = await saveBoardPost(c, false);
  const id = positive(created.id);
  const html = canonical(created.content);
  assert.equal((html.match(/jw-card-x/g) ?? []).length, 1);
  await openEditor(c, boardEdit(false, id));
  assert.equal(await editor(c).locator(".jw-media-youtube").count(), 1);
  assert.equal(await editor(c).locator(".jw-card-x").count(), 1);
  assert.equal(await editor(c).locator(`a[href="${failed}"]`).count(), 1);
  assert.equal(
    await editor(c).locator(`.jw-card a[href="${failed}"]`).count(),
    0,
  );
  const screenshots = [await shot(c, "url-editor-reopened")];
  await c.page.goto(c.base + boardShow(false, id));
  await c.page
    .locator(".jwsoft-tiptap-content .jw-media-youtube iframe")
    .waitFor();
  screenshots.push(await shot(c, "url-view"));
  return {
    postId: id,
    typedYoutubeCount,
    socialCardCount: 1,
    failedOriginalLinkCount: 1,
    failedCardCount: 0,
    savedAndReopened: true,
    screenshots,
  };
}
