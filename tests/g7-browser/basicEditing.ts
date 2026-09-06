import assert from "node:assert/strict";
import { editor } from "./context.ts";
import type { Context } from "./context.ts";

export const linkLabel = "jw-editor 링크 검증";
export const literalText = "<strong>서식 없는 본문</strong>";

/** Use actual G7 UI before saving; no editor registry or private state writes. */
export async function insertSafeText(c: Context): Promise<void> {
  await editor(c).press("ControlOrMeta+End");
  await editor(c).press("Enter");
  await c.page.getByRole("button", { name: "링크", exact: true }).click();
  const link = c.page.getByRole("dialog", { name: "링크", exact: true });
  await link.getByLabel("주소", { exact: true }).fill("https://example.com");
  await link.getByLabel("표시할 텍스트 (선택 사항)").fill(linkLabel);
  await link.getByRole("button", { name: "링크 적용", exact: true }).click();
  assert.equal(
    await editor(c).locator('a[href="https://example.com"]').innerText(),
    linkLabel,
  );
  await editor(c).press("ControlOrMeta+End");
  await editor(c).press("Enter");
  await c.page
    .getByRole("button", { name: "도구 더보기", exact: true })
    .click();
  await c.page
    .getByRole("button", { name: "텍스트만 붙여넣기", exact: true })
    .click();
  const plain = c.page.getByRole("dialog", {
    name: "텍스트만 붙여넣기",
    exact: true,
  });
  await plain.getByRole("textbox").fill(literalText);
  await plain.getByRole("button", { name: "텍스트 삽입", exact: true }).click();
  assert(
    (await editor(c).innerHTML()).includes(
      "&lt;strong&gt;서식 없는 본문&lt;/strong&gt;",
    ),
  );
  const cdp = await c.page.context().newCDPSession(c.page);
  const warning = c.page.waitForEvent("dialog");
  const reload = cdp.send("Page.reload");
  const dialog = await warning;
  assert.equal(dialog.type(), "beforeunload");
  await dialog.dismiss();
  await reload;
  assert((await editor(c).innerText()).includes(literalText));
  await cdp.detach();
}

export function assertSafeSavedText(html: string): void {
  assert(html.includes(linkLabel));
  assert(html.includes('href="https://example.com"'));
  assert(html.includes("&lt;strong&gt;서식 없는 본문&lt;/strong&gt;"));
}

export async function assertSaveClearedGuard(c: Context): Promise<void> {
  await c.page.waitForFunction(() => {
    const local = window.G7Core?.state?.getLocal?.();
    return local?.hasChanges !== true && local?.isSaving !== true;
  });
  const prevented = await c.page.evaluate(() => {
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  });
  assert.equal(
    prevented,
    false,
    "Successful G7 save must release the reload warning",
  );
}
