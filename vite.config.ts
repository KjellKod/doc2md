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

// WKWebView loads the desktop build from a file:// URL, so the default Vite-emitted
// `crossorigin` attribute on the module script and stylesheet link triggers a CORS
// check that file:// cannot satisfy, producing a blank window. This plugin strips
// the attribute only for the desktop build; hosted browser output is unchanged.
// It also injects a small inline error reporter that routes JS load/runtime errors
// into the window title so desktop failures surface even without Web Inspector.
const buildRootHtml = (mode: string) => ({
  name: "doc2md-build-root-html",
  transformIndexHtml: {
    order: "pre" as const,
    handler(html: string) {
      const buildRoot = mode === "desktop" ? "desktop" : "hosted";
      const marker = `<meta name="doc2md-build-root" content="${buildRoot}" />`;

      if (mode !== "desktop") {
        return html.replace("</head>", `    ${marker}\n  </head>`);
      }

      const withDesktopEntry = html.replace(
        "/src/main.tsx",
        "/src/desktop/main.tsx",
      );
      const stripped = withDesktopEntry.replace(
        /\s+crossorigin(?:="[^"]*")?/g,
        "",
      );
      const errorReporter = `<script>(()=>{const set=(m)=>{try{document.title="doc2md [ERR] "+m}catch(e){}};window.addEventListener("error",(e)=>{set((e.filename||"")+":"+(e.lineno||"")+" "+(e.message||e.error))});window.addEventListener("unhandledrejection",(e)=>{set("promise: "+(e.reason&&(e.reason.stack||e.reason.message)||e.reason))});})();</script>`;

      return stripped.replace(
        "</head>",
        `    ${marker}\n    ${errorReporter}\n  </head>`,
      );
    },
  },
});

export default defineConfig(({ mode }) => ({
  plugins: [react(), buildRootHtml(mode)],
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
