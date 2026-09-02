import assert from "node:assert/strict";
import path from "node:path";
import type { Page, Response } from "playwright";

export interface Context {
  page: Page;
  base: string;
  output: string;
  runId: string;
  timings: number[];
}
export type Observation = Record<string, unknown>;

export function object(value: unknown): Observation {
  assert(value !== null && typeof value === "object" && !Array.isArray(value));
  return value as Observation;
}
export function text(value: unknown): string {
  assert.equal(typeof value, "string");
  return value as string;
}
export function positive(value: unknown): number {
  assert.equal(typeof value, "number");
  assert(Number.isInteger(value) && Number(value) > 0);
  return value as number;
}
export const editor = ({ page }: Context) =>
  page.getByRole("textbox", { name: "jw-editor", exact: true });

export async function openEditor(c: Context, route: string): Promise<void> {
  const started = performance.now();
  await c.page.goto(c.base + route);
  await editor(c).waitFor();
  assert.equal(await editor(c).count(), 1);
  c.timings.push(performance.now() - started);
}

export async function shot(c: Context, name: string): Promise<string> {
  const file = path.join(c.output, `${name}.png`);
  await c.page.screenshot({ path: file, fullPage: false });
  return file;
}

export async function responseData(response: Response): Promise<Observation> {
  const payload = object(await response.json());
  assert(
    response.ok(),
    `HTTP ${response.status()} ${new URL(response.url()).pathname}: ${JSON.stringify(payload.errors ?? payload.message)}`,
  );
  assert.notEqual(payload.success, false);
  return object(payload.data);
}

export async function submit(
  c: Context,
  api: string,
  method: string,
  label: string,
): Promise<Observation> {
  const [response] = await Promise.all([
    c.page.waitForResponse(
      (r) =>
        new URL(r.url()).pathname === api && r.request().method() === method,
    ),
    c.page.getByRole("button", { name: label, exact: true }).first().click(),
  ]);
  return responseData(response);
}

export function canonical(value: unknown): string {
  const html = typeof value === "string" ? value : text(object(value).ko);
  assert(!/<(?:iframe|script|video|form)\b|\s(?:style|on\w+)\s*=/i.test(html));
  return html;
}

export async function uploadImage(c: Context): Promise<void> {
  await c.page.getByRole("button", { name: "이미지", exact: true }).click();
  const dialog = c.page.getByRole("dialog", { name: "이미지", exact: true });
  await dialog.waitFor();
  await dialog
    .locator("input[type=file]")
    .first()
    .setInputFiles(path.join(c.output, "fixture.png"));
  await dialog
    .getByRole("button", { name: "업로드 후 삽입", exact: true })
    .click();
  await dialog.waitFor({ state: "hidden" });
  await editor(c).locator("img").waitFor();
  const width = await editor(c)
    .locator("img")
    .evaluate((node: HTMLImageElement) => node.naturalWidth);
  assert(width > 0);
}

export async function imageWidth(
  c: Context,
  scope = ".jwsoft-tiptap-content",
): Promise<number> {
  const image = c.page.locator(`${scope} img`).first();
  await image.waitFor();
  await image.evaluate((node: HTMLImageElement) => node.decode());
  const width = await image.evaluate(
    (node: HTMLImageElement) => node.naturalWidth,
  );
  assert(width > 0);
  return width;
}
