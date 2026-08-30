import { Node } from "@tiptap/core";

export const PolicyTaskList = Node.create({
  name: "taskList",
  priority: 1000,
  group: "block",
  content: "taskItem+",
  parseHTML() {
    return [{ tag: "ul.jw-task-list" }];
  },
  renderHTML() {
    return ["ul", { class: "jw-task-list" }, 0];
  },
});

export const PolicyTaskItem = Node.create({
  name: "taskItem",
  priority: 1000,
  content: "paragraph block*",
  defining: true,
  addAttributes() {
    return {
      checked: {
        default: false,
        parseHTML: (element: HTMLElement) =>
          element.classList.contains("jw-task-checked"),
        renderHTML: () => ({}),
      },
    };
  },
  parseHTML() {
    return [{ tag: "li.jw-task-item" }];
  },
  renderHTML({ node }) {
    return [
      "li",
      {
        class: node.attrs.checked
          ? "jw-task-checked jw-task-item"
          : "jw-task-item",
      },
      0,
    ];
  },
  addKeyboardShortcuts() {
    return {
      Enter: () => this.editor.commands.splitListItem(this.name),
      Tab: () => this.editor.commands.sinkListItem(this.name),
      "Shift-Tab": () => this.editor.commands.liftListItem(this.name),
    };
  },
  addNodeView() {
    return ({ node, editor, getPos }) => {
      let current = node;
      const dom = document.createElement("li");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.contentEditable = "false";
      checkbox.setAttribute(
        "aria-label",
        window.G7Core?.locale?.current?.() === "en"
          ? "Complete task"
          : "할 일 완료",
      );
      const contentDOM = document.createElement("div");
      contentDOM.className = "jwsoft-task-content";
      dom.append(checkbox, contentDOM);
      const update = () => {
        dom.className = `jwsoft-task-node jw-task-item${current.attrs.checked ? " jw-task-checked" : ""}`;
        checkbox.checked = Boolean(current.attrs.checked);
        checkbox.disabled = !editor.isEditable;
      };
      checkbox.addEventListener("change", () => {
        const pos = getPos();
        if (!editor.isEditable || typeof pos !== "number") {
          update();
          return;
        }
        editor.view.dispatch(
          editor.state.tr.setNodeMarkup(pos, undefined, {
            ...current.attrs,
            checked: checkbox.checked,
          }),
        );
      });
      const editableChanged = () => {
        checkbox.disabled = !editor.isEditable;
      };
      editor.on("update", editableChanged);
      update();
      return {
        dom,
        contentDOM,
        update(next) {
          if (next.type !== current.type) return false;
          current = next;
          update();
          return true;
        },
        stopEvent: (event) => event.target === checkbox,
        destroy() {
          editor.off("update", editableChanged);
        },
      };
    };
  },
});
