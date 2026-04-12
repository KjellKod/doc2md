import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { getDisplayVersionInfo } from "./packages/core/scripts/release-version.mjs";

const displayVersion = getDisplayVersionInfo().version;

export default defineConfig({
  plugins: [react()],
  base: "/doc2md/",
  define: {
    __DOC2MD_DISPLAY_VERSION__: JSON.stringify(`v${displayVersion}`),
  },
  test: {
    environment: "jsdom",
    exclude: [
      ".claude/**",
      ".quest/**",
      ".worktrees/**",
      ".ws/**",
      "node_modules/**",
      "dist/**",
      "packages/**"
    ]
  }
});
