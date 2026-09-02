import { createEditor } from "@/editor/createEditor";
import { findTextMatches } from "@/editor/findReplace";
import { CellSelection } from "@tiptap/pm/tables";

describe("policy-safe writing tools", () => {
  function mount(content: string, editable = true) {
    const element = document.createElement("div");
    document.body.append(element);
    const editor = createEditor({
      element,
      content,
      editable,
      placeholder: "",
      onUpdate: vi.fn(),
    });
    return {
      editor,
      cleanup: () => {
        editor.destroy();
        element.remove();
      },
    };
  }
  it("changes only selected inline text and round-trips allowed tokens", () => {
    const { editor, cleanup } = mount("<p>가나다</p>");
    editor.commands.setTextSelection({ from: 2, to: 3 });
    editor.commands.setMark("jwTextStyle", {
      inlineSize: "jw-font-24",
      textColor: "jw-color-blue",
      highlight: "jw-highlight-yellow",
    });
    const html = editor.getHTML();
    expect(html).toBe(
      '<p>가<span class="jw-color-blue jw-font-24 jw-highlight-yellow">나</span>다</p>',
    );
    editor.commands.setContent(html);
    expect(editor.getHTML()).toBe(html);
    editor.commands.setTextSelection({ from: 2, to: 3 });
    editor.commands.setMark("jwTextStyle", {
      textColor: "evil",
      inlineSize: "style=bad",
    });
    expect(editor.getHTML()).not.toMatch(/evil|style=/);
    cleanup();
  });
  it("stores checklist state without UI controls and supports editable changes", () => {
    const { editor, cleanup } = mount(
      '<ul class="jw-task-list"><li class="jw-task-item"><p>할 일</p></li></ul>',
      false,
    );
    const checkbox = editor.view.dom.querySelector<HTMLInputElement>(
      'input[type="checkbox"]',
    )!;
    expect(checkbox.disabled).toBe(true);
    editor.setEditable(true);
    expect(checkbox.disabled).toBe(false);
    checkbox.click();
    expect(editor.getHTML()).toBe(
      '<ul class="jw-task-list"><li class="jw-task-checked jw-task-item"><p>할 일</p></li></ul><p></p>',
    );
    expect(editor.getHTML()).not.toMatch(/input|data-|style=/);
    cleanup();
  });
  it.each([false, true])(
    "starts a new task unchecked when splitting a task with checked=%s",
    (checked) => {
      const { editor, cleanup } = mount(
        `<ul class="jw-task-list"><li class="jw-task-item${checked ? " jw-task-checked" : ""}"><p>완료한 항목</p></li></ul>`,
      );
      editor.commands.setTextSelection(9);
      expect(editor.commands.splitListItem("taskItem")).toBe(true);
      const list = editor.state.doc.firstChild!;
      expect(list.childCount).toBe(2);
      expect(list.child(0).attrs.checked).toBe(checked);
      expect(list.child(1).attrs.checked).toBe(false);
      expect(list.child(0).textContent).toBe("완료한 항목");
      expect(editor.getHTML()).not.toMatch(/input|data-|style=/);
      cleanup();
    },
  );
  it("allows subscript and superscript without nesting them", () => {
    const { editor, cleanup } = mount("<p>H2O</p>");
    editor.commands.setTextSelection({ from: 2, to: 3 });
    editor.commands.toggleMark("subscript");
    expect(editor.getHTML()).toBe("<p>H<sub>2</sub>O</p>");
    editor.commands.toggleMark("superscript");
    expect(editor.getHTML()).toBe("<p>H<sup>2</sup>O</p>");
    cleanup();
  });
  it("merges and splits selected table cells while preserving cell tokens", () => {
    const { editor, cleanup } = mount(
      "<table><tr><td><p>A</p></td><td><p>B</p></td></tr><tr><td><p>C</p></td><td><p>D</p></td></tr></table>",
    );
    const cells: number[] = [];
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === "tableCell") cells.push(pos);
    });
    editor.view.dispatch(
      editor.state.tr.setSelection(
        CellSelection.create(editor.state.doc, cells[0], cells[1]),
      ),
    );
    expect(
      editor.commands.setClassToken("cellBackground", "jw-cell-blue"),
    ).toBe(true);
    expect(
      editor.commands.setClassToken("tableBorder", "jw-table-borderless"),
    ).toBe(true);
    expect(editor.commands.mergeCells()).toBe(true);
    expect(editor.getHTML()).toContain('colspan="2"');
    expect(editor.getHTML()).toContain("jw-cell-blue");
    expect(editor.commands.splitCell()).toBe(true);
    expect(editor.getHTML()).not.toContain('colspan="2"');
    expect(editor.getHTML()).toContain("jw-table-borderless");
    expect(editor.getHTML()).not.toContain("style=");
    cleanup();
  });
  it("resizes images with keyboard tokens and never serializes the handle", () => {
    const { editor, cleanup } = mount(
      '<figure class="jw-image jw-image-size-50 jw-image-align-center"><img src="/test.png" alt=""></figure>',
      false,
    );
    editor.setEditable(true);
    const handle =
      editor.view.dom.querySelector<HTMLButtonElement>('[role="slider"]')!;
    expect(handle.disabled).toBe(false);
    handle.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
    );
    expect(editor.getHTML()).toContain("jw-image-size-55");
    expect(editor.getHTML()).not.toMatch(/button|slider|style=|data-/);
    cleanup();
  });
  it("finds literal text across marks with correct unicode positions", () => {
    const { editor, cleanup } = mount(
      "<p>가<strong>나</strong>다 a.b A.B 😀</p><p>가나다</p>",
    );
    expect(findTextMatches(editor.state.doc, "가나다")).toHaveLength(2);
    expect(findTextMatches(editor.state.doc, "a.b")).toHaveLength(2);
    expect(findTextMatches(editor.state.doc, "a.b", true)).toHaveLength(1);
    const emoji = findTextMatches(editor.state.doc, "😀")[0];
    expect(emoji.to - emoji.from).toBe(2);
    for (const hit of findTextMatches(editor.state.doc, "가나다"))
      expect(editor.state.doc.textBetween(hit.from, hit.to)).toBe("가나다");
    cleanup();
  });
});
