import assert from "node:assert/strict";
import {
  canonical,
  editor,
  object,
  positive,
  shot,
  submit,
  text,
} from "./context.ts";
import type { Context, Observation } from "./context.ts";
import { waitForHostValue } from "./hostState.ts";

async function optionPrices(c: Context): Promise<void> {
  const table = c.page.getByRole("table").filter({
    has: c.page.getByRole("columnheader", { name: "안전재고", exact: true }),
  });
  await table.waitFor();
  const headers = await table.getByRole("columnheader").allTextContents();
  const row = table.locator("tbody tr").first();
  for (const [label, field, value] of [
    ["정가", "list_price", "1300"],
    ["판매가", "selling_price", "1150"],
    ["재고", "stock_quantity", "1"],
  ]) {
    const index = headers.indexOf(label);
    assert(index >= 0, `Missing option column: ${label}`);
    const input = row.getByRole("cell").nth(index).getByRole("spinbutton");
    await input.fill(value);
    await input.press("Tab");
    await waitForHostValue(c, ["form", "options", "0", field], value);
  }
}

async function productFields(c: Context, code: string): Promise<void> {
  await c.page.getByText("책", { exact: true }).click();
  await c.page.getByRole("button", { name: /선택한 카테고리 추가/ }).click();
  await c.page.getByRole("button", { name: /옵션그룹 추가/ }).click();
  await c.page
    .getByRole("textbox", { name: "옵션명 (예: 색상)", exact: true })
    .fill("종류");
  await waitForHostValue(c, ["ui", "optionInputs", "0", "name", "ko"], "종류");
  await c.page
    .getByRole("textbox", {
      name: "옵션값을 쉼표(,)로 구분하여 입력",
      exact: true,
    })
    .fill("검증용");
  await c.page
    .getByRole("textbox", {
      name: "옵션값을 쉼표(,)로 구분하여 입력",
      exact: true,
    })
    .press("Enter");
  await c.page
    .getByRole("dialog", { name: "추가", exact: true })
    .getByRole("button", { name: "추가", exact: true })
    .click();
  await waitForHostValue(
    c,
    ["ui", "optionInputs", "0", "values", "length"],
    "1",
  );
  await c.page.getByRole("button", { name: "옵션 생성", exact: true }).click();
  await c.page
    .getByRole("textbox", { name: "상품코드를 입력하세요", exact: true })
    .fill(code);
  await waitForHostValue(c, ["form", "product_code"], code);
  await c.page
    .getByRole("textbox", { name: "상품명을 입력하세요 (한국어)", exact: true })
    .fill(`JWSoft ${code}`);
  await waitForHostValue(c, ["form", "name", "ko"], `JWSoft ${code}`);
  await c.page.getByRole("tab", { name: "상품옵션", exact: true }).click();
  await optionPrices(c);
  for (const [name, value] of [
    ["list_price", "1300"],
    ["selling_price", "1150"],
  ]) {
    const input = c.page.locator(`input[name="${name}"]`);
    await input.fill(value);
    await input.press("Tab");
    await waitForHostValue(c, ["form", name], value);
  }
}

async function languages(c: Context, ko: string, en: string): Promise<void> {
  await editor(c).fill(ko);
  await c.page.getByRole("tab", { name: "English", exact: true }).click();
  await editor(c).fill(en);
  await c.page.getByRole("tab", { name: "한국어", exact: true }).click();
}

export async function productSurface(c: Context): Promise<Observation> {
  await c.page.goto(c.base + "/admin/ecommerce/products/create");
  await c.page
    .getByRole("textbox", { name: "상품코드를 입력하세요", exact: true })
    .waitFor();
  const code = `JW-${c.runId}`;
  await productFields(c, code);
  await c.page.getByRole("tab", { name: "상세설명", exact: true }).click();
  await languages(
    c,
    "jw-editor 한국어 새 상품",
    "jw-editor English new product",
  );
  const screenshots = [await shot(c, "product-create")];
  const created = await submit(
    c,
    "/api/modules/sirsoft-ecommerce/admin/products",
    "POST",
    "저장",
  );
  const id = positive(created.id);
  assert.equal(text(created.product_code), code);
  canonical(created.description);
  await c.page.goto(c.base + `/admin/ecommerce/products/${code}/edit`);
  await c.page.getByRole("tab", { name: "상세설명", exact: true }).click();
  const ko = `jw-editor 빠른 전환 저장 ${c.runId}`;
  const en = `jw-editor rapid switching ${c.runId}`;
  await languages(c, ko, en);
  const saved = await submit(
    c,
    `/api/modules/sirsoft-ecommerce/admin/products/${code}`,
    "PUT",
    "저장",
  );
  const description = object(saved.description);
  assert.equal(description.ko, `<p>${ko}</p>`);
  assert.equal(description.en, `<p>${en}</p>`);
  await c.page.reload();
  await c.page.getByRole("tab", { name: "상세설명", exact: true }).click();
  await editor(c).getByText(ko, { exact: true }).waitFor();
  screenshots.push(await shot(c, "product-ko"));
  await c.page.getByRole("tab", { name: "English", exact: true }).click();
  await editor(c).getByText(en, { exact: true }).waitFor();
  screenshots.push(await shot(c, "product-en"));
  await c.page.goto(c.base + `/shop/products/${code}`);
  await c.page.getByText(ko, { exact: true }).waitFor();
  screenshots.push(await shot(c, "product-public"));
  return {
    recordId: id,
    productId: id,
    productCode: code,
    create: true,
    reedit: true,
    show: true,
    rapidSwitchSavedBoth: true,
    screenshots,
  };
}
