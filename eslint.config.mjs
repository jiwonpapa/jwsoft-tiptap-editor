import tseslint from "typescript-eslint";
import fs from "node:fs";
import { editorRules } from "./scripts/eslint-rules.mjs";

const debt = JSON.parse(
  fs.readFileSync(
    new URL("./harness/governance/debt.json", import.meta.url),
    "utf8",
  ),
);

export default [
  { linterOptions: { noInlineConfig: true } },
  {
    ignores: [
      "dist/**",
      "vendor/**",
      ".build/**",
      ".venv/**",
      "resources/js/generated/**",
    ],
  },
  {
    files: ["resources/js/**/*.ts", "tests/**/*.ts", "*.config.ts"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { "@typescript-eslint": tseslint.plugin },
    rules: {
      "no-eval": "error",
      "no-new-func": "error",
      "no-empty": ["error", { allowEmptyCatch: false }],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-floating-promises": [
        "error",
        { ignoreVoid: false },
      ],
      "@typescript-eslint/no-misused-promises": [
        "error",
        { checksVoidReturn: true },
      ],
      "@typescript-eslint/await-thenable": "error",
      "@typescript-eslint/ban-ts-comment": "error",
      "no-restricted-imports": ["error", { patterns: ["**/.build/**"] }],
    },
  },
  {
    files: ["resources/js/**/*.ts"],
    ignores: ["**/*.test.ts"],
    plugins: { "jw-editor": editorRules(debt) },
    rules: {
      "jw-editor/bounded-functions": "error",
      "jw-editor/layer-imports": "error",
    },
  },
  {
    files: ["resources/js/editor/**/*.ts"],
    ignores: ["**/*.test.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            "@/handlers/*",
            "@/admin/*",
            "../handlers/*",
            "../admin/*",
            "**/.build/**",
          ],
        },
      ],
    },
  },
  {
    files: ["resources/js/policy/**/*.ts"],
    ignores: ["**/*.test.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            "@/handlers/*",
            "@/admin/*",
            "@/editor/*",
            "@/g7/*",
            "**/.build/**",
          ],
        },
      ],
    },
  },
  {
    files: ["scripts/**/*.mjs"],
    rules: { "no-eval": "error", "no-new-func": "error", "no-empty": "error" },
  },
];
