import { defineConfig } from "vitest/config";
import { cpSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { resolve as resolvePath } from "node:path";
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

// pdfjs-dist 5 hard-requires `standardFontDataUrl` for PDFs that use the
// standard fonts (Helvetica, Times, Symbol, ZapfDingbats, etc.). The fonts
// ship at node_modules/pdfjs-dist/standard_fonts/ but Vite does not include
// them automatically; without this plugin, real-world PDFs fail to convert
// with a cryptic JavaScriptCore "TypeError: undefined is not a function"
// from inside the worker. Bundle the directory into the build and serve
// it in dev so runtime can fetch fonts by filename.
const PDFJS_FONT_DIR = "pdfjs-dist/standard_fonts";

function bundlePdfjsStandardFonts() {
  const sourceDir = resolvePath("node_modules", PDFJS_FONT_DIR);

  return {
    name: "doc2md-pdfjs-standard-fonts",
    configureServer(server: {
      middlewares: { use: (route: string, handler: unknown) => void };
    }) {
      server.middlewares.use(
        "/standard_fonts",
        // @ts-expect-error -- minimal handler signature compatible with connect
        (req, res, next) => {
          try {
            const url = (req.url as string).split("?")[0];
            if (!url || url === "/" || url.includes("..")) {
              return next();
            }
            const fontPath = resolvePath(sourceDir, url.replace(/^\//, ""));
            const data = readFileSync(fontPath);
            res.setHeader("Content-Type", "application/octet-stream");
            res.end(data);
          } catch {
            next();
          }
        },
      );
    },
    closeBundle() {
      const outDir = resolvePath("dist/standard_fonts");
      mkdirSync(outDir, { recursive: true });
      for (const entry of readdirSync(sourceDir)) {
        cpSync(resolvePath(sourceDir, entry), resolvePath(outDir, entry));
      }
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), buildRootHtml(mode), bundlePdfjsStandardFonts()],
  base: mode === "desktop" ? "./" : "/doc2md/",
  server: {
    strictPort: true,
  },
  define: {
    __DOC2MD_DISPLAY_VERSION__: JSON.stringify(displayVersion),
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
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
