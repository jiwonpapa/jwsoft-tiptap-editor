import assert from "node:assert/strict";
import { createBoardPost } from "./boards.ts";
import { editor, object, shot } from "./context.ts";
import type { Context, Observation } from "./context.ts";

export async function invalidImages(c: Context): Promise<Observation> {
  await createBoardPost(c, false, "invalid images");
  await c.page.getByRole("button", { name: "이미지", exact: true }).click();
  const dialog = c.page.getByRole("dialog", { name: "이미지", exact: true });
  await dialog
    .locator("input[type=file]")
    .first()
    .setInputFiles({
      name: "invalid.png",
      mimeType: "image/png",
      buffer: Buffer.from("not a real image"),
    });
  const endpoint = "/api/plugins/jwsoft-tiptap-editor/upload";
  const [first] = await Promise.all([
    c.page.waitForResponse(
      (r) =>
        new URL(r.url()).pathname === endpoint &&
        r.request().method() === "POST",
    ),
    dialog.getByRole("button", { name: "업로드 후 삽입", exact: true }).click(),
  ]);
  assert.equal(first.status(), 422);
  const [retry] = await Promise.all([
    c.page.waitForResponse(
      (r) =>
        new URL(r.url()).pathname === endpoint &&
        r.request().method() === "POST",
    ),
    dialog
      .getByRole("button", { name: "재시도: invalid.png", exact: true })
      .click(),
  ]);
  assert.equal(retry.status(), 422);
  assert.equal(await editor(c).locator("img").count(), 0);
  const screenshots = [await shot(c, "invalid-image-retry")];
  await dialog.getByRole("button", { name: "취소", exact: true }).click();
  return {
    invalidRejected: true,
    retryRejected: true,
    statuses: [first.status(), retry.status()],
    screenshots,
  };
}

export async function emptyTitleEnter(c: Context): Promise<Observation> {
  await createBoardPost(c, false, "empty-body");
  const before = c.page.url();
  let writes = 0;
  const onRequest = (request: import("playwright").Request) => {
    if (request.method() === "POST" && request.url().includes("/posts"))
      writes++;
  };
  c.page.on("request", onRequest);
  try {
    await c.page
      .getByRole("textbox", { name: "제목을 입력하세요", exact: true })
      .press("Enter");
    await c.page
      .getByText("본문을 입력해 주세요.", { exact: true })
      .first()
      .waitFor();
    assert.equal(c.page.url(), before);
    assert.equal(writes, 0);
    return {
      rejectedBeforeHttp: true,
      reloadPrevented: true,
      screenshots: [await shot(c, "empty-title-enter")],
    };
  } finally {
    c.page.off("request", onRequest);
  }
}

export async function apiGet(c: Context, route: string): Promise<Observation> {
  const result: unknown = await c.page.evaluate(async (url) => {
    const token = localStorage.getItem("auth_token");
    const response = await fetch(url, {
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error(`Readback HTTP ${response.status}`);
    return response.json();
  }, route);
  return object(object(result).data);
}

export async function legacyConsent(
  c: Context,
  productId: number,
): Promise<Observation> {
  const api = `/api/modules/sirsoft-ecommerce/admin/products/${productId}`;
  await c.page.goto(c.base + `/admin/ecommerce/products/${productId}/edit`);
  await c.page.getByRole("tab", { name: "상세설명", exact: true }).click();
  await editor(c).waitFor();
  assert.equal(await editor(c).getAttribute("contenteditable"), "false");
  const before = (await apiGet(c, api)).description;
  await c.page.getByRole("tab", { name: "English", exact: true }).click();
  await editor(c).fill("English retained until explicit approval");
  const [rejected] = await Promise.all([
    c.page.waitForResponse(
      (r) =>
        new URL(r.url()).pathname === api && r.request().method() === "PUT",
    ),
    c.page.getByRole("button", { name: "저장", exact: true }).click(),
  ]);
  assert.equal(rejected.status(), 422);
  assert.deepEqual((await apiGet(c, api)).description, before);
  const screenshots = [await shot(c, "legacy-unapproved-save")];
  await c.page.getByRole("tab", { name: "한국어", exact: true }).click();
  assert.equal(await editor(c).getAttribute("contenteditable"), "false");
  await c.page
    .getByRole("button", { name: "위험 확인 후 편집 계속", exact: true })
    .click();
  assert.equal(await editor(c).getAttribute("contenteditable"), "true");
  const [approved] = await Promise.all([
    c.page.waitForResponse(
      (r) =>
        new URL(r.url()).pathname === api && r.request().method() === "PUT",
    ),
    c.page.getByRole("button", { name: "저장", exact: true }).click(),
  ]);
  assert.equal(approved.status(), 200);
  const after = object((await apiGet(c, api)).description);
  assert.equal(after.ko, `<p>Legacy ${c.runId}</p>`);
  assert.equal(after.en, "<p>English retained until explicit approval</p>");
  return {
    rejectedStatus: rejected.status(),
    preservedBeforeApproval: true,
    approvedStatus: approved.status(),
    screenshots,
  };
}
