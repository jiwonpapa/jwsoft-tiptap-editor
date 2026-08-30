import { Mark } from "@tiptap/core";
import { EDITOR_POLICY } from "@/generated/editorPolicy";

export const INLINE_CATEGORIES = [
  "inlineSize",
  "textColor",
  "highlight",
] as const;
export type InlineCategory = (typeof INLINE_CATEGORIES)[number];

function allowed(category: InlineCategory, value: unknown): string | null {
  return typeof value === "string" &&
    (EDITOR_POLICY.classTokens[category] as readonly string[]).includes(value)
    ? value
    : null;
}

export const PolicyTextStyle = Mark.create({
  name: "jwTextStyle",
  addAttributes() {
    return Object.fromEntries(
      INLINE_CATEGORIES.map((category) => [
        category,
        {
          default: null,
          parseHTML: (element: HTMLElement) =>
            EDITOR_POLICY.classTokens[category].find((token) =>
              element.classList.contains(token),
            ) ?? null,
          renderHTML: () => ({}),
        },
      ]),
    );
  },
  parseHTML() {
    return [{ tag: "span[class]" }];
  },
  renderHTML({ mark }) {
    const tokens = INLINE_CATEGORIES.map((category) =>
      allowed(category, mark.attrs[category]),
    )
      .filter(Boolean)
      .sort();
    return ["span", tokens.length ? { class: tokens.join(" ") } : {}, 0];
  },
});

export const PolicySubscript = Mark.create({
  name: "subscript",
  excludes: "superscript",
  parseHTML() {
    return [{ tag: "sub" }];
  },
  renderHTML() {
    return ["sub", 0];
  },
});
export const PolicySuperscript = Mark.create({
  name: "superscript",
  excludes: "subscript",
  parseHTML() {
    return [{ tag: "sup" }];
  },
  renderHTML() {
    return ["sup", 0];
  },
});
