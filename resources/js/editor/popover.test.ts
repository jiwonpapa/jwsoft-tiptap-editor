import { createEditor } from "@/editor/createEditor";
import { createPopover } from "@/editor/popover";
import { labelMenuAction } from "@/editor/menuControls";

describe("editor panel lifecycle and selection", () => {
  function mount() {
    const element = document.createElement("div");
    document.body.append(element);
    const editor = createEditor({
      element,
      content: "<p>가나다</p>",
      placeholder: "",
      editable: true,
      onUpdate: vi.fn(),
    });
    const menu = createPopover("서식", "text", { editor });
    document.body.append(menu.trigger, menu.panel);
    const cleanup = () => {
      menu.destroy();
      editor.destroy();
      element.remove();
      menu.trigger.remove();
    };
    return { editor, menu, cleanup };
  }
  it("restores a mapped selection before applying a command and closes the panel", () => {
    const { editor, menu, cleanup } = mount();
    const command = document.createElement("button");
    command.setAttribute("aria-label", "굵게");
    labelMenuAction(command);
    command.addEventListener("click", () => editor.commands.toggleBold());
    menu.panel.append(command);
    editor.commands.setTextSelection({ from: 2, to: 3 });
    menu.open();
    editor.commands.insertContentAt(1, "앞");
    editor.commands.setTextSelection(1);
    command.click();
    expect(editor.getHTML()).toBe("<p>앞가<strong>나</strong>다</p>");
    expect(menu.trigger.getAttribute("aria-expanded")).toBe("false");
    expect(document.documentElement.style.overflow).not.toBe("hidden");
    cleanup();
  });
  it("closes a previous panel before another panel opens", () => {
    const { editor, menu, cleanup } = mount();
    const second = createPopover("목록", "list", { editor });
    document.body.append(second.trigger, second.panel);
    menu.open();
    second.open();
    expect(menu.trigger.getAttribute("aria-expanded")).toBe("false");
    expect(second.trigger.getAttribute("aria-expanded")).toBe("true");
    second.destroy();
    second.trigger.remove();
    cleanup();
  });
  it("restores the trigger with Escape and restores scroll after destruction", () => {
    const { menu, cleanup } = mount();
    const original = document.documentElement.style.overflow;
    menu.open();
    document.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        cancelable: true,
      }),
    );
    expect(document.activeElement).toBe(menu.trigger);
    expect(menu.trigger.getAttribute("aria-expanded")).toBe("false");
    menu.open();
    cleanup();
    expect(document.documentElement.style.overflow).toBe(original);
  });
  it("does not open disabled controls or serialize menu labels into HTML", () => {
    const { editor, menu, cleanup } = mount();
    menu.trigger.disabled = true;
    menu.open();
    expect(menu.trigger.getAttribute("aria-expanded")).toBe("false");
    expect(editor.getHTML()).toBe("<p>가나다</p>");
    cleanup();
  });
});
