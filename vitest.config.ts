import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    include: ["tests/scaffold/**/*.test.ts", "resources/js/**/*.test.ts"],
    coverage: {
      reporter: ["text", "json-summary"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(root, "resources/js"),
    },
  },
});
