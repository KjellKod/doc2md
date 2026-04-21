import { defineConfig } from "vitest/config";
import { readFileSync } from "node:fs";
import react from "@vitejs/plugin-react";
import { getDisplayVersionInfo } from "./packages/core/scripts/release-version.mjs";

function readCorePackageVersion() {
  try {
    const packageJson = JSON.parse(
      readFileSync(new URL("./packages/core/package.json", import.meta.url), "utf8"),
    ) as { version?: string };

    if (typeof packageJson.version === "string" && packageJson.version.length > 0) {
      return packageJson.version;
    }
  } catch {
    // Fall through to the final static fallback below.
  }

  return "0.0.0";
}

const displayVersion = (() => {
  try {
    const info = getDisplayVersionInfo();

    if (info.latestTag === "0.0.0") {
      return `${readCorePackageVersion()}-dev`;
    }

    return info.version;
  } catch {
    return `${readCorePackageVersion()}-dev`;
  }
})();

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: mode === "desktop" ? "./" : "/doc2md/",
  server: {
    strictPort: true,
  },
  define: {
    __DOC2MD_DISPLAY_VERSION__: JSON.stringify(displayVersion),
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
      "packages/**",
    ],
  },
}));
