import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { defineConfig } from "vite";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  build: {
    ssr: true,
    outDir: "dist",
    emptyOutDir: true,
    target: "node22",
    sourcemap: true,
    lib: {
      entry: {
        index: resolve(__dirname, "src/index.ts"),
        cli: resolve(__dirname, "src/cli.ts")
      },
      formats: ["es"],
      fileName: (_format, entryName) => `${entryName}.js`
    },
    rollupOptions: {
      external: [/^node:/]
    }
  }
});
