import { Extension, type Editor } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { NodeSelection, type EditorState } from "@tiptap/pm/state";

import { EDITOR_CLASS_TOKENS, EDITOR_POLICY } from "@/generated/editorPolicy";

export type ClassTokenCategory = keyof typeof EDITOR_POLICY.classTokens;

const ATTRIBUTE_NAME = "jwClassTokens";
const ATTRIBUTE_NODE_TYPES = [
  "paragraph",
  "heading",
  "blockquote",
  "bulletList",
  "orderedList",
  "codeBlock",
  "table",
  "tableHeader",
  "tableCell",
  "image",
] as const;
const EDITABLE_NODE_TYPES: Record<ClassTokenCategory, readonly string[]> = {
  textSize: ["paragraph", "heading", "codeBlock"],
  alignment: ["paragraph", "heading", "codeBlock"],
  spacing: ["paragraph", "heading", "codeBlock"],
  table: ["table"],
  image: ["image"],
  media: [],
  card: [],
};
const allowedTokens = new Set<string>(EDITOR_CLASS_TOKENS);

function categoryTokens(category: ClassTokenCategory): readonly string[] {
  return EDITOR_POLICY.classTokens[category];
}

export function normalizeClassTokens(value: unknown): string {
  if (typeof value !== "string") return "";
  return [
    ...new Set(value.split(/\s+/u).filter((token) => allowedTokens.has(token))),
  ]
    .sort()
    .join(" ");
}

interface TokenTarget {
  node: ProseMirrorNode;
  pos: number;
}

function tokenTargets(
  state: EditorState,
  category: ClassTokenCategory,
): TokenTarget[] {
  const eligible = new Set(EDITABLE_NODE_TYPES[category]);
  const { selection } = state;
  const targets = new Map<number, ProseMirrorNode>();

  if (
    selection instanceof NodeSelection &&
    eligible.has(selection.node.type.name)
  ) {
    targets.set(selection.from, selection.node);
  }

  if (selection.empty) {
    for (let depth = selection.$from.depth; depth > 0; depth -= 1) {
      const node = selection.$from.node(depth);
      if (!eligible.has(node.type.name)) continue;
      targets.set(selection.$from.before(depth), node);
      break;
    }
  } else {
    state.doc.nodesBetween(selection.from, selection.to, (node, pos) => {
      if (eligible.has(node.type.name)) targets.set(pos, node);
    });
  }

  if (category === "table" && targets.size === 0) {
    for (let depth = selection.$from.depth; depth > 0; depth -= 1) {
      const node = selection.$from.node(depth);
      if (node.type.name !== "table") continue;
      targets.set(selection.$from.before(depth), node);
      break;
    }
  }

  return [...targets].map(([pos, node]) => ({ pos, node }));
}

function nextClassTokens(
  current: unknown,
  category: ClassTokenCategory,
  token: string | null,
): string {
  const categorySet = new Set<string>(categoryTokens(category));
  const remaining = normalizeClassTokens(current)
    .split(/\s+/u)
    .filter((candidate) => candidate && !categorySet.has(candidate));
  if (token) remaining.push(token);
  return normalizeClassTokens(remaining.join(" "));
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    jwsoftClassTokens: {
      setClassToken: (
        category: ClassTokenCategory,
        token: string | null,
      ) => ReturnType;
      toggleClassToken: (
        category: ClassTokenCategory,
        token: string,
      ) => ReturnType;
    };
  }
}

export const ClassTokenExtension = Extension.create({
  name: "jwsoftClassTokens",

  addGlobalAttributes() {
    return [
      {
        types: [...ATTRIBUTE_NODE_TYPES],
        attributes: {
          [ATTRIBUTE_NAME]: {
            default: "",
            parseHTML: (element: HTMLElement) =>
              normalizeClassTokens(element.getAttribute("class")),
            renderHTML: (attributes: Record<string, unknown>) => {
              const className = normalizeClassTokens(
                attributes[ATTRIBUTE_NAME],
              );
              return className ? { class: className } : {};
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setClassToken:
        (category: ClassTokenCategory, token: string | null) =>
        ({ state, tr, dispatch }) => {
          if (
            token !== null &&
            !(categoryTokens(category) as readonly string[]).includes(token)
          ) {
            return false;
          }
          const targets = tokenTargets(state, category);
          if (targets.length === 0) return false;
          if (dispatch) {
            for (const { node, pos } of targets) {
              tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                [ATTRIBUTE_NAME]: nextClassTokens(
                  node.attrs[ATTRIBUTE_NAME],
                  category,
                  token,
                ),
              });
            }
            dispatch(tr);
          }
          return true;
        },
      toggleClassToken:
        (category: ClassTokenCategory, token: string) =>
        ({ editor, commands }) =>
          commands.setClassToken(
            category,
            activeClassToken(editor, category) === token ? null : token,
          ),
    };
  },
});

export function activeClassToken(
  editor: Editor,
  category: ClassTokenCategory,
): string | null {
  const targets = tokenTargets(editor.state, category);
  if (targets.length === 0) return null;
  const tokens = targets.map(({ node }) => {
    const current = new Set(
      normalizeClassTokens(node.attrs[ATTRIBUTE_NAME]).split(/\s+/u),
    );
    return categoryTokens(category).find((token) => current.has(token)) ?? null;
  });
  const first = tokens[0];
  return tokens.every((token) => token === first) ? first : null;
}
