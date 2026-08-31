import { afterEach, describe, expect, it } from "vitest";
import { createEditor } from "./createEditor";
import { installFormSubmitGuard } from "./formSubmitGuard";
import type { Editor } from "@tiptap/core";

const editors: Editor[] = [];
afterEach(() => {
  editors.splice(0).forEach((editor) => editor.destroy());
  document.body.replaceChildren();
});
function setup(content = "<p></p>", editable = true) {
  document.body.innerHTML =
    '<form><input name="title"><div id="mount"></div><p id="status"></p><button type="button">등록</button></form><form id="other"></form>';
  const form = document.querySelector("form")!;
  const status = document.querySelector<HTMLElement>("#status")!;
  const editor = createEditor({
    element: document.querySelector<HTMLElement>("#mount")!,
    content,
    editable,
    placeholder: "",
    onUpdate() {},
  });
  editors.push(editor);
  const cleanup = installFormSubmitGuard(editor, status, "ko");
  const submit = (target = form, submitter: HTMLElement | null = null) => {
    const event = new SubmitEvent("submit", {
      bubbles: true,
      cancelable: true,
      submitter,
    });
    target.dispatchEvent(event);
    return event.defaultPrevented;
  };
  return { form, status, editor, submit, cleanup };
}
describe("unhandled implicit form submission fallback", () => {
  it("blocks empty-body navigation, announces the error and focuses the editor", () => {
    const { editor, status, submit } = setup("<p>\u200b&nbsp;</p>");
    expect(submit()).toBe(true);
    expect(status.textContent).toBe("본문을 입력해 주세요.");
    expect(status.getAttribute("role")).toBe("alert");
    expect(editor.view.dom.getAttribute("aria-invalid")).toBe("true");
    editor.commands.setContent("<p>내용</p>");
    expect(status.textContent).toBe("");
    expect(editor.view.dom.hasAttribute("aria-invalid")).toBe(false);
  });
  it.each(["<p>내용</p>", '<img src="/image.png">'])(
    "keeps meaningful content and delegates saving to the host button",
    (content) => {
      const { submit, status } = setup(content);
      expect(submit()).toBe(true);
      expect(status.textContent).toBe("본문 편집 후 등록 버튼을 눌러 주세요.");
    },
  );
  it("does not take over explicit actions, POST forms, submit controls, or other forms", () => {
    const { form, submit } = setup();
    form.setAttribute("action", "");
    expect(submit()).toBe(false);
    form.removeAttribute("action");
    form.method = "post";
    expect(submit()).toBe(false);
    form.removeAttribute("method");
    expect(submit(form, form.querySelector("button"))).toBe(false);
    expect(submit(document.querySelector<HTMLFormElement>("#other")!)).toBe(
      false,
    );
  });
  it("lets framework submit handlers run first", () => {
    const { form, submit, status } = setup();
    form.addEventListener("submit", (event) => event.preventDefault());
    expect(submit()).toBe(true);
    expect(status.textContent).toBe("");
  });
  it("does not move focus while composing or unlock legacy read-only content", () => {
    const { form, submit, editor, status } = setup("", false);
    form.dispatchEvent(
      new CompositionEvent("compositionstart", { bubbles: true }),
    );
    expect(submit()).toBe(true);
    expect(status.textContent).toBe("");
    form.dispatchEvent(
      new CompositionEvent("compositionend", { bubbles: true }),
    );
    expect(submit()).toBe(true);
    expect(status.textContent).toBe(
      "본문의 편집 가능 여부를 먼저 확인해 주세요.",
    );
    expect(editor.isEditable).toBe(false);
  });
  it("removes listeners on disposal and ignores detached editors", () => {
    const { form, submit, cleanup } = setup();
    form.remove();
    expect(submit()).toBe(false);
    document.body.append(form);
    cleanup();
    expect(submit()).toBe(false);
  });
});
