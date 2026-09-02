import assert from "node:assert/strict";
import { editor, openEditor, shot } from "./context.ts";
import type { Context, Observation } from "./context.ts";

export async function mobileAndLocale(c: Context): Promise<Observation> {
  await openEditor(c, "/admin/board/free/create");
  await c.page.getByRole("button", { name: "언어", exact: true }).click();
  await c.page
    .locator("#language_selector_desktop")
    .getByRole("button", { name: "English", exact: true })
    .click();
  const toolbar = c.page.getByRole("toolbar", {
    name: "standard editor tools",
    exact: true,
  });
  await toolbar.waitFor();
  const tabbable = await toolbar
    .locator("button")
    .evaluateAll(
      (nodes: HTMLButtonElement[]) =>
        nodes.filter((node) => !node.disabled && node.tabIndex >= 0).length,
    );
  assert(tabbable > 0);
  const screenshots = [await shot(c, "english-toolbar")];
  await c.page.getByRole("button", { name: "Language", exact: true }).click();
  await c.page
    .locator("#language_selector_desktop")
    .getByRole("button", { name: "한국어", exact: true })
    .click();
  await c.page.getByRole("button", { name: "언어", exact: true }).waitFor();
  await c.page.setViewportSize({ width: 390, height: 844 });
  await openEditor(c, "/admin/board/free/create");
  await c.page
    .getByRole("button", { name: "Toggle theme", exact: true })
    .filter({ visible: true })
    .click();
  await c.page.getByRole("button", { name: /다크 모드/ }).click();
  await c.page.waitForFunction(
    () => document.documentElement.getAttribute("data-theme") === "dark",
  );
  await c.page.locator("#g7-transition-overlay").waitFor({ state: "detached" });
  await editor(c).scrollIntoViewIfNeeded();
  const responsive = await c.page.evaluate(() => {
    const tools = document.querySelector<HTMLElement>("[role=toolbar]");
    if (!tools) throw new Error("Toolbar missing");
    return {
      viewport: { width: innerWidth, height: innerHeight },
      theme: document.documentElement.getAttribute("data-theme"),
      toolbarClientWidth: tools.clientWidth,
      toolbarScrollWidth: tools.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
    };
  });
  assert(responsive.toolbarScrollWidth <= responsive.toolbarClientWidth + 1);
  assert(responsive.bodyScrollWidth <= responsive.viewport.width + 1);
  screenshots.push(await shot(c, "mobile-dark"));
  await c.page.setViewportSize({ width: 1280, height: 900 });
  return { responsive, locales: ["ko", "en"], tabbable, screenshots };
}

export async function fallback(c: Context): Promise<Observation> {
  await c.page.goto(c.base + "/admin/settings?tab=notification_definitions");
  await c.page
    .getByRole("button", { name: "편집", exact: true })
    .first()
    .click();
  const dialog = c.page.getByRole("dialog");
  await dialog.waitFor();
  await dialog.locator("textarea").waitFor();
  const tiptapInstances = await dialog.locator(".tiptap").count();
  const dialogTextareas = await dialog.locator("textarea").count();
  assert.equal(tiptapInstances, 0);
  assert.equal(dialogTextareas, 1);
  const screenshots = [await shot(c, "direct-html-fallback")];
  await dialog.getByRole("button", { name: "취소", exact: true }).click();
  return { tiptapInstances, dialogTextareas, screenshots };
}
