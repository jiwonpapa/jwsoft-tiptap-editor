import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["tests/dom-setup.ts"],
    include: ["tests/scaffold/**/*.test.ts", "resources/js/**/*.test.ts"],
    coverage: {
      provider: "v8",
      thresholds: { statements: 70, branches: 59, functions: 69, lines: 72 },
      include: ["resources/js/**/*.ts"],
      exclude: [
        "resources/js/**/*.test.ts",
        "resources/js/generated/**",
        "resources/js/**/*.d.ts",
      ],
      reporter: ["text", "json-summary"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(root, "resources/js"),
    },
  },
});
