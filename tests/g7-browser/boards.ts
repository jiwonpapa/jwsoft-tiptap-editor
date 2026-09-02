import assert from "node:assert/strict";
import {
  canonical,
  editor,
  imageWidth,
  openEditor,
  positive,
  shot,
  submit,
  uploadImage,
} from "./context.ts";
import type { Context, Observation } from "./context.ts";

export const board = "free";
export const boardApi = (admin: boolean, slug = board) =>
  `/api/modules/sirsoft-board/${admin ? "admin/board" : "boards"}/${slug}/posts`;
export const boardEdit = (admin: boolean, id: number, slug = board) =>
  admin ? `/admin/board/${slug}/${id}/edit` : `/board/${slug}/${id}/edit`;
export const boardShow = (admin: boolean, id: number) =>
  admin ? `/admin/board/${board}/post/${id}` : `/board/${board}/${id}`;

export async function createBoardPost(
  c: Context,
  admin: boolean,
  label: string,
  slug = board,
): Promise<void> {
  await openEditor(
    c,
    admin ? `/admin/board/${slug}/create` : `/board/${slug}/write`,
  );
  await c.page
    .getByRole("textbox", {
      name: admin ? "게시글 제목을 입력하세요" : "제목을 입력하세요",
      exact: true,
    })
    .fill(`JWSoft ${label} ${c.runId}`);
}

export async function saveBoardPost(
  c: Context,
  admin: boolean,
  id?: number,
  slug = board,
): Promise<Observation> {
  return submit(
    c,
    boardApi(admin, slug) + (id ? `/${id}` : ""),
    id ? "PUT" : "POST",
    admin || id ? "저장" : "등록",
  );
}

export async function boardSurface(
  c: Context,
  admin: boolean,
): Promise<Observation> {
  const name = admin ? "admin-board" : "public-board";
  await createBoardPost(c, admin, name);
  const body = `jw-editor ${name} create ${c.runId}`;
  await editor(c).fill(body);
  await editor(c).press("ControlOrMeta+b");
  await editor(c).press("End");
  await editor(c).press("Enter");
  await editor(c).pressSequentially("strong");
  await uploadImage(c);
  const screenshots = [await shot(c, `${name}-create`)];
  const created = await saveBoardPost(c, admin);
  const id = positive(created.id);
  assert(canonical(created.content).includes(body));
  await c.page.goto(c.base + boardShow(admin, id));
  const loadedWidth = await imageWidth(c);
  await c.page.getByText(body, { exact: true }).first().waitFor();
  screenshots.push(await shot(c, `${name}-show`));
  await openEditor(c, boardEdit(admin, id));
  assert((await editor(c).innerHTML()).includes(body));
  await editor(c).locator("p").first().click();
  await c.page.keyboard.press("End");
  await c.page.keyboard.insertText(" updated");
  const updated = await saveBoardPost(c, admin, id);
  assert(canonical(updated.content).includes("updated"));
  await openEditor(c, boardEdit(admin, id));
  assert((await editor(c).innerHTML()).includes("updated"));
  screenshots.push(await shot(c, `${name}-reedit`));
  let replyId = 0;
  if (!admin) {
    await createBoardPost(c, false, "reply parent", "qna");
    await editor(c).fill("jw-editor owned reply parent");
    const parent = await saveBoardPost(c, false, undefined, "qna");
    const parentId = positive(parent.id);
    await openEditor(c, `/board/qna/write?parent_id=${parentId}`);
    await c.page
      .getByRole("textbox", { name: "제목을 입력하세요", exact: true })
      .fill(`JWSoft reply ${c.runId}`);
    await editor(c).fill(`jw-editor reply ${c.runId}`);
    const reply = await saveBoardPost(c, false, undefined, "qna");
    replyId = positive(reply.id);
    assert.equal(Number(reply.parent_id), parentId);
    await openEditor(c, boardEdit(false, replyId, "qna"));
    assert((await editor(c).innerText()).includes("jw-editor reply"));
    screenshots.push(await shot(c, "public-board-reply"));
  }
  return {
    postId: id,
    recordId: id,
    replyId,
    create: true,
    reedit: true,
    show: true,
    loadedWidth,
    savedAndReopened: true,
    canonicalHtml: canonical(updated.content),
    screenshots,
  };
}
