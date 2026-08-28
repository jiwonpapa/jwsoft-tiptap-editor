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
      entry: path.resolve(root, "resources/js/index.ts"),
      name: "JWSoftTiptapEditor",
      fileName: "plugin",
      formats: ["iife"],
    },
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: ["1", "true"].includes(
      (process.env.G7_BUILD_SOURCEMAP ?? "").toLowerCase(),
    ),
    minify: "esbuild",
    target: "es2020",
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        entryFileNames: "js/plugin.iife.js",
        chunkFileNames: "js/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(root, "resources/js"),
    },
  },
});
