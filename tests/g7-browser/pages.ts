import assert from "node:assert/strict";
import {
  canonical,
  editor,
  openEditor,
  positive,
  shot,
  submit,
} from "./context.ts";
import type { Context, Observation } from "./context.ts";

export async function pageSurface(c: Context): Promise<Observation> {
  await openEditor(c, "/admin/pages/create");
  const slug = `jw-editor-${c.runId}`;
  await c.page
    .getByRole("textbox", { name: "url-slug", exact: true })
    .fill(slug);
  await c.page.getByRole("button", { name: "중복 확인", exact: true }).click();
  await c.page
    .getByText("사용 가능한 슬러그입니다.", { exact: true })
    .waitFor();
  await c.page.getByRole("button", { name: "미발행", exact: true }).click();
  await c.page.getByRole("listbox").getByText("발행", { exact: true }).click();
  await c.page
    .getByRole("textbox", {
      name: "페이지 제목을 입력하세요 (한국어)",
      exact: true,
    })
    .fill(`JWSoft page ${c.runId}`);
  const body = `jw-editor 페이지 저장 검증 ${c.runId}`;
  await editor(c).fill(body);
  await c.page
    .getByRole("combobox", { name: "문단 종류", exact: true })
    .selectOption({ label: "제목 2" });
  const screenshots = [await shot(c, "page-create")];
  const created = await submit(
    c,
    "/api/modules/sirsoft-page/admin/pages",
    "POST",
    "저장",
  );
  const id = positive(created.id);
  assert(canonical(created.content).includes(`<h2>${body}</h2>`));
  await openEditor(c, `/admin/pages/${id}/edit`);
  await editor(c).locator("h2").fill(`${body} 완료`);
  const saved = await submit(
    c,
    `/api/modules/sirsoft-page/admin/pages/${id}`,
    "PUT",
    "저장",
  );
  assert(canonical(saved.content).includes(`${body} 완료`));
  await openEditor(c, `/admin/pages/${id}/edit`);
  await editor(c).getByText(`${body} 완료`, { exact: true }).waitFor();
  screenshots.push(await shot(c, "page-reedit"));
  await c.page.goto(c.base + `/page/${slug}`);
  await c.page
    .getByRole("heading", { name: `${body} 완료`, exact: true })
    .waitFor();
  screenshots.push(await shot(c, "page-public"));
  return {
    recordId: id,
    slug,
    create: true,
    reedit: true,
    show: true,
    screenshots,
  };
}
