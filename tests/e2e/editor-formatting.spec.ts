import { expect, test } from "@playwright/test";
import {
  pluginVersion,
  recordBrowserEvidence,
  mountEditor,
  insertTool,
  menuAction,
} from "./editor-fixture";

test("link quote lists alignment and indentation use policy-safe controls", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desktop");
  await mountEditor(
    page,
    "standard",
    false,
    false,
    false,
    false,
    "<p>첫째 링크</p><p>둘째 링크</p>",
  );
  const editable = page.locator(".jwsoft-tiptap-editable");
  await editable.click();
  await page.keyboard.press("ControlOrMeta+A");

  await insertTool(page, "링크");
  const linkDialog = page.getByRole("dialog", { name: "링크" });
  await linkDialog.getByLabel("주소").fill("https://example.com/proof");
  await linkDialog.getByRole("button", { name: "링크 적용" }).click();
  await expect(editable.locator("a")).toHaveCount(2);

  await page.getByRole("button", { name: "문단 모양", exact: true }).click();
  await page
    .getByLabel("정렬", { exact: true })
    .selectOption("jw-align-center");
  await page.getByRole("button", { name: "들여쓰기", exact: true }).click();
  const alignedIndentedParagraphs = editable.locator(
    "p.jw-align-center.jw-indent-1",
  );
  await expect(alignedIndentedParagraphs).toHaveCount(2);
  const alignedIndentedCount = await alignedIndentedParagraphs.count();
  await menuAction(page, "문단 모양", "내어쓰기");
  await expect(editable.locator("p.jw-indent-1")).toHaveCount(0);
  await menuAction(page, "문단 모양", "들여쓰기");

  await menuAction(page, "문단 모양", "인용");
  await expect(editable.locator("blockquote")).toHaveCount(1);
  const blockquoteAppliedCount = await editable.locator("blockquote").count();
  await menuAction(page, "목록", "글머리 목록");
  await expect(editable.locator("ul")).toHaveCount(1);
  const bulletListAppliedCount = await editable.locator("ul").count();
  await menuAction(page, "목록", "글머리 목록");
  await menuAction(page, "목록", "번호 목록");
  await expect(editable.locator("ol")).toHaveCount(1);

  await page.keyboard.press("Escape");
  await editable.locator("li").nth(1).click();
  await menuAction(page, "문단 모양", "들여쓰기");
  await expect(editable.locator("ol")).toHaveCount(2);
  const nestedOrderedListCount = await editable.locator("ol").count();
  await menuAction(page, "문단 모양", "내어쓰기");
  await expect(editable.locator("ol")).toHaveCount(1);
  await expect(editable.locator("[style]")).toHaveCount(0);

  recordBrowserEvidence("editor-indentation.json", testInfo.project.name, {
    linkCount: await editable.locator("a").count(),
    blockquoteAppliedCount,
    bulletListAppliedCount,
    orderedListCount: await editable.locator("ol").count(),
    alignedIndentedCount,
    indentationToken: "jw-indent-1",
    nestedOrderedListCount,
    listIndentationRoundTrip: true,
    inlineStyleCount: await editable.locator("[style]").count(),
  });
});

test("document typography and explicit tokens match editor and public content", async ({
  page,
}, testInfo) => {
  const content =
    '<p>본문</p><h2>제목 2</h2><h3>제목 3</h3><h4>제목 4</h4><blockquote><p>인용문</p></blockquote><p><span class="jw-color-blue jw-highlight-yellow jw-font-24">색상 조합</span></p><p class="jw-text-lg jw-space-relaxed">문단 토큰</p><ul class="jw-task-list"><li class="jw-task-item jw-task-checked"><p>완료한 항목</p></li></ul><table class="jw-table jw-table-borderless"><tbody><tr><td class="jw-cell-blue jw-cell-middle" colspan="1" rowspan="1"><p>셀</p></td></tr></tbody></table><hr><p>끝</p>';
  await mountEditor(page, "standard", false, false, false, false, content);
  await expect(page.getByRole("textbox", { name: "jw-editor" })).toBeEditable();
  await expect(page.locator(".jwsoft-tiptap-legacy-warning")).toHaveCount(0);
  await page.evaluate(async (saved) => {
    const output = document.createElement("div");
    output.className = "jwsoft-tiptap-content prose";
    output.innerHTML = saved;
    document.body.appendChild(output);
    await window.__e2eHandlers["jwsoft-tiptap-editor.injectContentStyles"]({
      params: {},
    });
  }, content);
  await page.addStyleTag({
    content:
      "h2,h3,h4{font-size:inherit;font-weight:inherit;margin:0} .prose :where(h2,h3,h4){font-size:inherit} body{margin:8px} html.dark body{background:#111827} *{box-sizing:border-box}",
  });
  const themes = [];
  for (const theme of ["light", "dark"]) {
    await page.evaluate(
      (dark) => document.documentElement.classList.toggle("dark", dark),
      theme === "dark",
    );
    const measurements = await page.evaluate(() => {
      const selectors = [
        "h2",
        "h3",
        "h4",
        "blockquote",
        "span.jw-color-blue",
        "p.jw-text-lg",
        "ul.jw-task-list",
        "td.jw-cell-middle",
        "hr",
      ];
      const sample = (root: Element) =>
        Object.fromEntries(
          selectors.map((selector) => {
            const style = getComputedStyle(root.querySelector(selector)!);
            return [
              selector,
              Object.fromEntries(
                [
                  "fontSize",
                  "fontWeight",
                  "color",
                  "backgroundColor",
                  "lineHeight",
                  "listStyleType",
                  "paddingInlineStart",
                  "verticalAlign",
                  "borderTopWidth",
                  "borderTopColor",
                ].map((key) => [key, style[key as keyof CSSStyleDeclaration]]),
              ),
            ];
          }),
        );
      return {
        editor: sample(document.querySelector(".jwsoft-tiptap-editable")!),
        content: sample(document.querySelector(".jwsoft-tiptap-content")!),
      };
    });
    expect(measurements.content).toEqual(measurements.editor);
    const styles = measurements.content;
    expect(parseFloat(styles.h2.fontSize as string)).toBeGreaterThan(
      parseFloat(styles.h3.fontSize as string),
    );
    expect(parseFloat(styles.h3.fontSize as string)).toBeGreaterThan(
      parseFloat(styles.h4.fontSize as string),
    );
    expect(parseFloat(styles.h4.fontSize as string)).toBeGreaterThan(16);
    expect(styles["span.jw-color-blue"].color).toBe("rgb(29, 78, 216)");
    expect(styles["span.jw-color-blue"].backgroundColor).toBe(
      "rgb(254, 240, 138)",
    );
    expect(styles["p.jw-text-lg"].fontSize).toBe("18px");
    expect(styles["p.jw-text-lg"].lineHeight).toBe("36px");
    expect(styles["ul.jw-task-list"].listStyleType).toBe("none");
    expect(styles["ul.jw-task-list"].paddingInlineStart).toBe("0px");
    await expect(page.locator(".jwsoft-task-node")).toHaveCSS(
      "padding-inline-start",
      "0px",
    );
    expect(styles["td.jw-cell-middle"].verticalAlign).toBe("middle");
    expect(styles["td.jw-cell-middle"].borderTopColor).toBe("rgba(0, 0, 0, 0)");
    expect(styles.hr.borderTopWidth).toBe("1px");
    themes.push({ theme, ...measurements });
  }
  recordBrowserEvidence(
    `editor-document-appearance-${testInfo.project.name}.json`,
    testInfo.project.name,
    { themes },
  );
  await page.screenshot({
    path: testInfo.outputPath("document-appearance.png"),
    fullPage: true,
  });
});

test("Enter after a completed task creates an unchecked task and empty Enter exits the list", async ({
  page,
}) => {
  await mountEditor(
    page,
    "standard",
    false,
    false,
    false,
    false,
    '<ul class="jw-task-list"><li class="jw-task-item jw-task-checked"><p>완료한 항목</p></li></ul>',
  );
  const editable = page.getByRole("textbox", { name: "jw-editor" });
  await editable.getByText("완료한 항목", { exact: true }).click();
  await page.keyboard.press(
    process.platform === "darwin" ? "Meta+ArrowRight" : "End",
  );
  await expect
    .poll(() =>
      page.evaluate(() => {
        const selection = document.getSelection();
        return {
          text: selection?.anchorNode?.textContent,
          offset: selection?.anchorOffset,
          modelOffset: (
            document.querySelector(".jwsoft-tiptap-editable") as HTMLElement & {
              editor: import("@tiptap/core").Editor;
            }
          ).editor.state.selection.$from.parentOffset,
        };
      }),
    )
    .toEqual({ text: "완료한 항목", offset: 6, modelOffset: 6 });
  await page.keyboard.press("Enter");
  await page.keyboard.insertText("새 항목");
  const checks = editable.getByRole("checkbox");
  await expect(checks).toHaveCount(2);
  await expect(checks.nth(0)).toBeChecked();
  await expect(checks.nth(1)).not.toBeChecked();
  await expect(editable.locator("li p")).toHaveText(["완료한 항목", "새 항목"]);
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await page.keyboard.insertText("목록 밖 본문");
  await expect(
    editable.locator(":scope > p").filter({ hasText: "목록 밖 본문" }),
  ).toHaveCount(1);
  await expect(checks).toHaveCount(2);
});

test("inline appearance find-replace checklist and fullscreen stay policy-safe", async ({
  page,
}, testInfo) => {
  await mountEditor(
    page,
    "standard",
    false,
    false,
    false,
    false,
    "<p>가나다 가나다</p>",
  );
  const editable = page.locator(".jwsoft-tiptap-editable");
  await editable.click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.getByRole("button", { name: "글자 모양", exact: true }).click();
  await page
    .getByLabel("글자 크기", { exact: true })
    .selectOption("jw-font-24");
  await page.getByRole("button", { name: "글자색: 파랑", exact: true }).click();
  await expect(editable.locator("span.jw-color-blue.jw-font-24")).toHaveText(
    "가나다 가나다",
  );
  await page.getByRole("button", { name: "도구 더보기" }).click();
  await page
    .getByRole("button", { name: "찾기 / 바꾸기", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "찾기 / 바꾸기",
    exact: true,
  });
  await dialog.getByLabel("찾을 내용").fill("가나다");
  await dialog.getByLabel("바꿀 내용").fill("수정");
  await expect(dialog.getByRole("status")).toHaveText("2개 일치");
  await dialog.getByRole("button", { name: "모두 바꾸기" }).click();
  await dialog.getByRole("button", { name: "닫기" }).click();
  await expect(editable).toHaveText("수정 수정");
  await editable.focus();
  await page.keyboard.press("ControlOrMeta+Z");
  await expect(editable).toHaveText("가나다 가나다");
  await page.keyboard.press("ControlOrMeta+A");
  await menuAction(page, "목록", "체크리스트");
  await page.keyboard.press("Escape");
  await editable.getByRole("checkbox").first().check();
  await expect(editable.locator("li.jw-task-checked")).toHaveCount(1);
  await page.getByRole("button", { name: "도구 더보기" }).click();
  await page.getByRole("button", { name: "전체화면", exact: true }).click();
  await expect(page.locator(".jwsoft-editor-fullscreen")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(page.locator(".jwsoft-editor-fullscreen")).toHaveCount(0);
  const html = await page.evaluate(() => {
    const values = window.__e2eStateUpdates.filter(
      (item) => typeof item.updates["form.content"] === "string",
    );
    return values[values.length - 1].updates["form.content"] as string;
  });
  expect(html).toContain("jw-task-checked");
  expect(html).not.toMatch(/style=|data-|<input|<button/);
  await page.screenshot({
    path: testInfo.outputPath("editor-writing-tools.png"),
    fullPage: true,
    animations: "disabled",
  });
});

test("table context controls and image resize are usable on the rendered editor", async ({
  page,
}, testInfo) => {
  await page.route("https://images.example/proof.png", (route) =>
    route.fulfill({
      contentType: "image/png",
      body: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
        "base64",
      ),
    }),
  );
  await mountEditor(
    page,
    "standard",
    false,
    false,
    false,
    false,
    '<table><tbody><tr><td colspan="1" rowspan="1"><p>셀</p></td><td colspan="1" rowspan="1"><p>둘</p></td></tr></tbody></table><p>이미지</p><figure class="jw-image jw-image-align-center jw-image-size-50"><img src="https://images.example/proof.png" alt="예시"></figure><p>끝</p>',
  );
  const editable = page.locator(".jwsoft-tiptap-editable");
  await editable.locator("td").first().click();
  const context = page.getByRole("toolbar", { name: "표 편집 도구" });
  await expect(context).toBeVisible();
  await context
    .getByLabel("셀 배경", { exact: true })
    .selectOption("jw-cell-blue");
  await context
    .getByLabel("세로 정렬", { exact: true })
    .selectOption("jw-cell-middle");
  await context
    .getByLabel("표 테두리", { exact: true })
    .selectOption("jw-table-borderless");
  await expect(editable.locator("td").first()).toHaveClass(/jw-cell-blue/);
  await expect(editable.locator("td").first()).toHaveClass(/jw-cell-middle/);
  await context.getByRole("button", { name: "행 추가", exact: true }).click();
  await expect(editable.locator("tr")).toHaveCount(2);
  await editable.locator("img").click();
  const handle = editable.getByRole("slider", { name: "이미지 너비 조절" });
  await expect(handle).toBeVisible();
  await handle.focus();
  await page.keyboard.press("ArrowRight");
  await expect(editable.locator("figure.jw-image")).toHaveClass(
    /jw-image-size-55/,
  );
  if (testInfo.project.name === "chromium-desktop") {
    await handle.scrollIntoViewIfNeeded();
    const bounds = await handle.boundingBox();
    const width = await editable.evaluate((element) => element.clientWidth);
    await page.mouse.move(
      bounds!.x + bounds!.width / 2,
      bounds!.y + bounds!.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      bounds!.x + bounds!.width / 2 - width * 0.1,
      bounds!.y + bounds!.height / 2,
      { steps: 6 },
    );
    await page.mouse.up();
    await expect(editable.locator("figure.jw-image")).toHaveClass(
      /jw-image-size-45/,
    );
  }
  await expect(editable.locator("[style]")).toHaveCount(0);
  await page.screenshot({
    path: testInfo.outputPath("editor-context-tools.png"),
    fullPage: true,
    animations: "disabled",
  });
});

test("product footer exposes the package version and accessible read-only help", async ({
  page,
}, testInfo) => {
  await mountEditor(
    page,
    "minimal",
    false,
    false,
    false,
    false,
    "<p>도움말 본문</p>",
  );
  const footer = page.locator(".jwsoft-editor-footer");
  await expect(footer).toHaveCount(1);
  await expect(footer).toContainText("jw-editor");
  await expect(footer).toContainText(`v${pluginVersion}`);
  await expect(footer).toContainText("6자");
  const help = footer.getByRole("button", { name: "jw-editor 도움말" });
  await help.click();
  const dialog = page.getByRole("dialog", { name: "jw-editor 도움말" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("설치만으로 기존 글은 바뀌지 않습니다.");
  await dialog.getByText("HTML 소스 보기 (읽기 전용)").click();
  const source = dialog.getByRole("textbox", { name: "읽기 전용 HTML 소스" });
  await expect(source).toHaveAttribute("readonly", "");
  await expect(source).toHaveValue("<p>도움말 본문</p>");
  await expect(dialog.locator("script, iframe")).toHaveCount(0);
  const before = await page.locator(".jwsoft-tiptap-editable").innerHTML();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(help).toBeFocused();
  expect(await page.locator(".jwsoft-tiptap-editable").innerHTML()).toBe(
    before,
  );
  const layout = await footer.evaluate((element) => ({
    width: element.getBoundingClientRect().width,
    scrollWidth: element.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }));
  expect(layout.width).toBeLessThanOrEqual(layout.viewport);
  expect(layout.scrollWidth).toBeLessThanOrEqual(Math.ceil(layout.width));
  recordBrowserEvidence(
    `editor-product-footer-${testInfo.project.name}.json`,
    testInfo.project.name,
    {
      product: "jw-editor",
      version: pluginVersion,
      sourceReadOnly: true,
      responsive: true,
    },
  );
});
