import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
  build: {
    lib: {
      entry: path.resolve(
        root,
        "resources/js/features/image-editor/vendorEntry.ts",
      ),
      name: "JWSoftImageEditorBundle",
      fileName: "image-editor",
      formats: ["iife"],
    },
    outDir: "dist",
    emptyOutDir: false,
    sourcemap: ["1", "true"].includes(
      (process.env.G7_BUILD_SOURCEMAP ?? "").toLowerCase(),
    ),
    minify: "esbuild",
    target: "es2020",
    chunkSizeWarningLimit: 2_000,
    rollupOptions: {
      output: {
        entryFileNames: "js/image-editor.iife.js",
        assetFileNames: "assets/image-editor-[name]-[hash][extname]",
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(root, "resources/js"),
    },
  },
});
