import path from "node:path";

const functions = new Set([
  "FunctionDeclaration",
  "FunctionExpression",
  "ArrowFunctionExpression",
]);

function binding(node, source) {
  if (node.id) return node.id.name;
  const parent = node.parent;
  if (parent.type === "VariableDeclarator") return source.getText(parent.id);
  if (parent.type === "Property" || parent.type === "MethodDefinition")
    return source.getText(parent.key);
  if (parent.type === "CallExpression")
    return `call:${source.getText(parent.callee)}:${parent.arguments.indexOf(node)}`;
  return parent.type;
}

export function functionIdentity(node, source) {
  return [
    ...source.getAncestors(node).filter((item) => functions.has(item.type)),
    node,
  ]
    .map((item) => binding(item, source))
    .join("/");
}

function resolvedImport(filename, value, root) {
  if (value.startsWith("@/"))
    return path.resolve(root, "resources/js", value.slice(2));
  if (value.startsWith(".")) return path.resolve(path.dirname(filename), value);
  return null;
}

export function editorRules(debt) {
  return {
    rules: {
      "bounded-functions": {
        meta: {
          type: "problem",
          schema: [],
          messages: {
            limit:
              "Function {{identity}} has {{lines}} lines; maximum {{maximum}}.",
          },
        },
        create(context) {
          const file = path
            .relative(context.cwd, context.filename)
            .split(path.sep)
            .join("/");
          const exceptions = debt.functions[file]?.symbols ?? {};
          const used = new Set();
          const inspect = (node) => {
            const identity = functionIdentity(node, context.sourceCode);
            const maximum = used.has(identity)
              ? 80
              : (exceptions[identity] ?? 80);
            used.add(identity);
            const lines = node.loc.end.line - node.loc.start.line + 1;
            if (lines > maximum)
              context.report({
                node,
                messageId: "limit",
                data: { identity, lines, maximum },
              });
          };
          return Object.fromEntries(
            [...functions].map((type) => [type, inspect]),
          );
        },
      },
      "layer-imports": {
        meta: {
          type: "problem",
          schema: [],
          messages: {
            boundary: "Import crosses the {{layer}} layer boundary.",
          },
        },
        create(context) {
          const base = path.join(context.cwd, "resources/js");
          const layer = path
            .relative(base, context.filename)
            .split(path.sep)[0];
          const forbidden =
            layer === "policy"
              ? ["editor", "handlers", "admin", "g7"]
              : layer === "editor"
                ? ["handlers", "admin"]
                : [];
          const inspect = (node) => {
            if (!node.source || !forbidden.length) return;
            const value = node.source.value;
            if (typeof value !== "string") {
              if (node.type === "ImportExpression")
                context.report({
                  node,
                  messageId: "boundary",
                  data: { layer },
                });
              return;
            }
            const target = resolvedImport(context.filename, value, context.cwd);
            const targetLayer =
              target && path.relative(base, target).split(path.sep)[0];
            if (forbidden.includes(targetLayer))
              context.report({ node, messageId: "boundary", data: { layer } });
          };
          return {
            ImportDeclaration: inspect,
            ExportNamedDeclaration: inspect,
            ExportAllDeclaration: inspect,
            ImportExpression: inspect,
          };
        },
      },
    },
  };
}
