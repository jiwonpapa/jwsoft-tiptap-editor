import { expect, test } from "@playwright/test";
import { mountEditor, insertTool, menuAction } from "./editor-fixture";

test("title Enter keeps the document and title, requires body and leaves explicit save usable", async ({
  page,
}) => {
  await mountEditor(
    page,
    "standard",
    false,
    false,
    false,
    false,
    "<p></p>",
    "http://jwsoft.test",
    true,
  );
  const title = page.getByRole("textbox", { name: "제목", exact: true });
  await title.fill("Enter 회귀검사");
  await title.press("Enter");
  await expect(page).toHaveURL("http://jwsoft.test/");
  await expect(title).toHaveValue("Enter 회귀검사");
  await expect(page.getByRole("alert")).toHaveText("본문을 입력해 주세요.");
  const body = page.getByRole("textbox", {
    name: "jw-editor",
    exact: true,
  });
  await expect(body).toBeFocused();
  await body.fill("본문 내용");
  await expect(body).not.toHaveAttribute("aria-invalid", "true");
  await title.press("Enter");
  await expect(page).toHaveURL("http://jwsoft.test/");
  await expect(title).toHaveValue("Enter 회귀검사");
  await expect(page.locator(".jwsoft-tiptap-status")).toHaveText(
    "본문 편집 후 등록 버튼을 눌러 주세요.",
  );
  await page
    .getByRole("button", { name: "등록", exact: true })
    .evaluate((button) => {
      button.addEventListener("click", () => {
        button.textContent = "저장 액션 실행";
      });
    });
  const save = page.getByRole("button", { name: "등록", exact: true });
  await save.focus();
  await save.press("Enter");
  await expect(
    page.getByRole("button", { name: "저장 액션 실행", exact: true }),
  ).toBeVisible();
});

test("focused menus expose named tools and keyboard actions without mixing categories", async ({
  page,
}, testInfo) => {
  await mountEditor(page, "full");
  const more = page.getByRole("button", { name: "도구 더보기", exact: true });
  await more.focus();
  await page.keyboard.press("ArrowDown");
  const panel = page.getByRole("dialog", { name: "도구 더보기", exact: true });
  await expect(panel).toBeVisible();
  await expect(
    panel.locator("[data-editor-command] .jwsoft-menu-text"),
  ).toHaveText(["찾기 / 바꾸기", "전체화면"]);
  await expect(
    panel.getByRole("button", { name: "찾기 / 바꾸기", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(
    panel.getByRole("button", { name: "전체화면", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(more).toBeFocused();
  await expect(panel).not.toBeVisible();
  const editable = page.locator(".jwsoft-tiptap-editable");
  await editable.click();
  await page.keyboard.press("ControlOrMeta+A");
  await menuAction(page, "목록", "번호 목록");
  await expect(editable.locator("ol li")).toHaveText("선택 영역 테스트");
  await expect(editable).toBeFocused();
  await editable.locator("ol li").click();
  await page.getByRole("button", { name: "목록", exact: true }).click();
  const lists = page.getByRole("dialog", { name: "목록", exact: true });
  await expect(
    lists.getByRole("button", { name: "번호 목록", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(lists.locator(".jwsoft-menu-text")).toHaveText([
    "글머리 목록",
    "번호 목록",
    "체크리스트",
  ]);
  await page.screenshot({
    path: testInfo.outputPath("editor-list-menu.png"),
    fullPage: true,
    animations: "disabled",
  });
  await page.keyboard.press("Escape");
  await more.click();
  await page.screenshot({
    path: testInfo.outputPath("editor-more-menu.png"),
    fullPage: true,
    animations: "disabled",
  });
  await panel
    .getByRole("button", { name: "찾기 / 바꾸기", exact: true })
    .click();
  await expect(panel).not.toBeVisible();
  const find = page.getByRole("dialog", { name: "찾기 / 바꾸기", exact: true });
  await expect(find).toBeVisible();
  await expect(page.locator("dialog[open]")).toHaveCount(1);
  await find.getByRole("button", { name: "닫기", exact: true }).click();
  await expect(more).toBeFocused();
});

test("toolbar keeps history visible at 360 390 768 and 1280 pixels", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desktop");
  await mountEditor(page, "full", false, true, false, true);
  const toolbar = page.locator(".jwsoft-tiptap-toolbar");
  for (const width of [1280, 768, 390, 360, 1280]) {
    await page.setViewportSize({ width, height: 840 });
    const folded = toolbar.getByRole("button", {
      name: "삽입 도구",
      exact: true,
    });
    if (width < 768) await expect(folded).toBeVisible();
    if (width === 1280) await expect(folded).not.toBeVisible();
    await expect(
      toolbar.getByRole("button", { name: /^실행취소/ }),
    ).toBeVisible();
    await expect(
      toolbar.getByRole("button", { name: /^다시실행/ }),
    ).toBeVisible();
    const metrics = await toolbar.evaluate((element) => ({
      width: element.clientWidth,
      scroll: element.scrollWidth,
      height: element.getBoundingClientRect().height,
      page: document.documentElement.scrollWidth,
      viewport: window.innerWidth,
    }));
    expect(metrics.scroll).toBeLessThanOrEqual(metrics.width);
    expect(metrics.page).toBeLessThanOrEqual(metrics.viewport);
    expect(metrics.height).toBeLessThanOrEqual(width <= 640 ? 104 : 52);
    await page.screenshot({
      path: testInfo.outputPath(`toolbar-${width}.png`),
      fullPage: true,
      animations: "disabled",
    });
  }
  // Narrow embedded editors fold on container width even on a wide desktop.
  await page.locator("main").evaluate((element) => {
    element.style.width = "360px";
  });
  await expect(
    toolbar.getByRole("button", { name: "삽입 도구", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "문단 모양", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "문단 모양", exact: true }),
  ).toHaveAttribute("data-presentation", "popover");
});

test("mobile formatting sheet preserves selection traps focus and returns to visible triggers", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-mobile");
  await mountEditor(page, "standard");
  const editable = page.locator(".jwsoft-tiptap-editable");
  await editable.click();
  await page.keyboard.press("ControlOrMeta+A");
  const top = await editable.evaluate(
    (element) => element.getBoundingClientRect().top,
  );
  const trigger = page.getByRole("button", { name: "문단 모양", exact: true });
  await trigger.click();
  const sheet = page.getByRole("dialog", { name: "문단 모양", exact: true });
  await expect(sheet).toHaveAttribute("data-presentation", "sheet");
  await expect(sheet).toHaveAttribute("aria-modal", "true");
  const box = await sheet.boundingBox();
  expect(box!.y + box!.height).toBeGreaterThan(
    (await page.evaluate(() => window.innerHeight)) - 20,
  );
  for (let step = 0; step < 9; step++) {
    await page.keyboard.press("Tab");
    expect(
      await sheet.evaluate((element) =>
        element.contains(document.activeElement),
      ),
    ).toBe(true);
  }
  await sheet
    .getByLabel("정렬", { exact: true })
    .selectOption("jw-align-center");
  await expect(editable.locator("p.jw-align-center")).toHaveText(
    "선택 영역 테스트",
  );
  await sheet
    .getByLabel("줄 간격", { exact: true })
    .selectOption("jw-space-relaxed");
  await page.screenshot({
    path: testInfo.outputPath("editor-paragraph-sheet.png"),
    fullPage: true,
    animations: "disabled",
  });
  await sheet.getByRole("button", { name: "들여쓰기", exact: true }).click();
  await expect(sheet).not.toBeVisible();
  await expect(editable).toBeFocused();
  await expect(
    editable.locator("p.jw-align-center.jw-space-relaxed.jw-indent-1"),
  ).toHaveCount(1);
  expect(
    await editable.evaluate((element) => element.getBoundingClientRect().top),
  ).toBe(top);
  await insertTool(page, "이미지");
  await expect(page.locator("dialog[open]")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "삽입 도구", exact: true }),
  ).toBeFocused();
  await page.getByRole("button", { name: "글자 모양", exact: true }).click();
  const textSheet = page.getByRole("dialog", {
    name: "글자 모양",
    exact: true,
  });
  await textSheet
    .getByLabel("글자 크기", { exact: true })
    .selectOption("jw-font-20");
  await page.screenshot({
    path: testInfo.outputPath("editor-text-sheet.png"),
    fullPage: true,
    animations: "disabled",
  });
  await textSheet
    .getByRole("button", { name: "글자색: 파랑", exact: true })
    .click();
  await expect(editable.locator("span.jw-color-blue.jw-font-20")).toHaveText(
    "선택 영역 테스트",
  );
  await expect(textSheet).not.toBeVisible();
  await expect(editable).toBeFocused();
});

test("desktop toolbar keeps selection commands and keyboard focus usable", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desktop");
  await mountEditor(page);
  const editable = page.locator(".jwsoft-tiptap-editable");
  const bold = page
    .locator(".jwsoft-tiptap-toolbar")
    .getByRole("button", { name: /굵게/ });
  await bold.focus();
  await expect(bold).toBeFocused();
  await page.keyboard.press("ArrowRight");
  const focused = await page.evaluate(() => ({
    text: document.activeElement?.textContent,
    tag: document.activeElement?.tagName,
    disabled: (document.activeElement as HTMLButtonElement | null)?.disabled,
  }));
  expect(focused).toEqual({ text: "기울임", tag: "BUTTON", disabled: false });

  await editable.click();
  await page.keyboard.press("ControlOrMeta+A");
  await bold.click();
  await expect(editable.locator("strong")).toHaveText("선택 영역 테스트");

  await page.screenshot({
    path: testInfo.outputPath("editor-toolbar-desktop.png"),
    fullPage: true,
    animations: "disabled",
  });
});

test("mobile toolbar uses grouped menus and a non-reflowing modal", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-mobile");
  await mountEditor(page, "full");
  const toolbar = page.getByRole("toolbar");
  const metrics = await toolbar.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
    pageWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth);
  expect(metrics.pageWidth).toBeLessThanOrEqual(metrics.viewportWidth);

  const boldBox = await page
    .getByRole("button", { name: /굵게/ })
    .boundingBox();
  expect(boldBox?.height).toBeGreaterThanOrEqual(44);
  const editorTop = await page
    .locator(".jwsoft-tiptap-editable")
    .evaluate((element) => element.getBoundingClientRect().top);
  await insertTool(page, "이미지");
  const dialog = page.getByRole("dialog", { name: "이미지" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute("aria-modal", "true");
  await expect
    .poll(() => dialog.evaluate((element) => getComputedStyle(element).opacity))
    .toBe("1");
  expect(
    await page
      .locator(".jwsoft-tiptap-editable")
      .evaluate((element) => element.getBoundingClientRect().top),
  ).toBe(editorTop);
  const dialogBox = await dialog.boundingBox();
  expect(dialogBox?.x).toBeGreaterThanOrEqual(0);
  expect((dialogBox?.x ?? 0) + (dialogBox?.width ?? 0)).toBeLessThanOrEqual(
    await page.evaluate(() => window.innerWidth),
  );

  await page.screenshot({
    path: testInfo.outputPath("editor-toolbar-mobile.png"),
    fullPage: true,
    animations: "disabled",
  });
});
