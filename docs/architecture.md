---
title: System Architecture
purpose: Technical reference for doc2md's dual-surface architecture — shared converter layer, web UI, and @doc2md/core npm package.
audience: Contributors, maintainers, and package consumers
scope: Full system architecture covering shared code, build targets, runtime compatibility, and deployment
status: active
owner: maintainers
last_updated: 2026-04-11
related:
  - docs/publishing-doc2md-core.md
  - docs/using-doc2md-core.md
---

# System Architecture

doc2md converts documents to Markdown through two surfaces — a browser-based web UI and a Node.js npm package — both powered by a single shared converter layer.

```
                        ┌──────────────────────────┐
                        │    /src/converters/       │
                        │  (shared source of truth) │
                        │                           │
                        │  csv, docx, html, json,   │
                        │  md, pdf, pptx, tsv,      │
                        │  txt, xlsx                 │
                        │                           │
                        │  + runtime bridge          │
                        │  + utility modules         │
                        └─────────┬────────┬────────┘
                                  │        │
                    ┌─────────────┘        └──────────────┐
                    │                                     │
                    ▼                                     ▼
     ┌──────────────────────────┐        ┌───────────────────────────┐
     │   Web UI                 │        │   @doc2md/core            │
     │                          │        │                           │
     │   React + Vite           │        │   Vite SSR lib build      │
     │   Static site build      │        │   Target: Node 22         │
     │   → GitHub Pages         │        │   → npm tarball + CLI     │
     │                          │        │                           │
     │   /src/components/       │        │   /packages/core/src/     │
     │   /src/App.tsx           │        │   index.ts (API)          │
     │   vite.config.ts (root)  │        │   cli.ts (CLI entry)      │
     │                          │        │   batch.ts, io.ts         │
     │   DOMParser: native      │        │   node-compat.ts          │
     │   (globalThis)           │        │   DOMParser: jsdom        │
     └──────────────────────────┘        └───────────────────────────┘
```

## Shared Converter Layer

All document conversion logic lives in `/src/converters/`. Both the web UI and the npm package import from this directory as their single source of truth.

### Supported Formats

| Format | Converter | Key dependency |
|--------|-----------|----------------|
| CSV    | `csv.ts`  | `delimited.ts` (shared table renderer) |
| DOCX   | `docx.ts` | mammoth, turndown |
| HTML   | `html.ts` | turndown, `richText.ts` |
| JSON   | `json.ts` | Built-in |
| MD     | `md.ts`   | Passthrough |
| PDF    | `pdf.ts`  | pdfjs-dist |
| PPTX   | `pptx.ts` | jszip |
| TSV    | `tsv.ts`  | `delimited.ts` |
| TXT    | `txt.ts`  | Built-in |
| XLSX   | `xlsx.ts` | read-excel-file, `office.ts` |

Format dispatch is handled by `index.ts`, which maps each `SupportedFormat` string to its converter function via a `Record<SupportedFormat, Converter>`.

### Utility Modules

| Module | Role |
|--------|------|
| `runtime.ts` | Runtime compatibility bridge (DOMParser resolution) |
| `types.ts` | `ConversionResult` and `Converter` type definitions |
| `messages.ts` | Shared error/warning message constants |
| `delimited.ts` | Shared delimiter-based table parsing and Markdown rendering |
| `office.ts` | Shared helpers for Office formats (mammoth, read-excel-file) |
| `richText.ts` | HTML-to-Markdown conversion via turndown with table handling |
| `readText.ts` | Runtime-aware text file reading (FileReader vs Blob.text()) |
| `readBinary.ts` | Runtime-aware binary file reading (FileReader vs Blob.arrayBuffer()) |

### ConversionResult Contract

Every converter returns `Promise<ConversionResult>`:

```typescript
interface ConversionResult {
  markdown: string;                    // The converted Markdown output
  warnings: string[];                  // Human-readable warnings (empty if clean)
  status: "success" | "warning" | "error";
  quality?: {                          // Optional, used by PDF converter
    level: "good" | "review" | "poor";
    summary: string;
  };
}
```

## Build Targets

### Web UI (GitHub Pages)

**Build config:** Root `vite.config.ts`

- Vite + React (`@vitejs/plugin-react`)
- Base path: `/doc2md/`
- Produces a static site deployed to GitHub Pages
- Test environment: jsdom (via vitest)

**Data flow:**

1. User drops one or more files into the React UI
2. The browser selects the matching converter via `convertFile()` in `/src/converters/index.ts`
3. The converter returns a `ConversionResult` with Markdown, warnings, and status
4. The user reviews the result locally and downloads `.md` files

**Web-only code:** React components in `/src/components/`, `App.tsx`, and UI state management.

### @doc2md/core (npm package)

**Build config:** `packages/core/vite.config.ts`

- Vite SSR lib build (`build.ssr: true`)
- Target: `node22`
- ES module format
- Two entry points: `index.ts` (API) and `cli.ts` (CLI)
- Externals: `node:*` built-in modules
- Output: `packages/core/dist/`

**Programmatic API** (`@doc2md/core`):

```typescript
import { convertDocument, convertDocuments } from "@doc2md/core";

// Single document
const result = await convertDocument("report.pdf", { outputDir: "./out" });

// Batch (with concurrency and limits)
const batch = await convertDocuments(
  ["a.docx", "b.xlsx"],
  { outputDir: "./out", maxDocuments: 50, concurrency: 4 }
);
```

Both functions call `ensureNodeCompat()` before delegating to the shared converter layer.

**CLI** (`doc2md`):

```
doc2md <input...> -o <output-dir> [--max <n>] [--concurrency <n>]
```

**npm-only code in `packages/core/src/`:**

| Module | Role |
|--------|------|
| `index.ts` | Public API surface (`convertDocument`, `convertDocuments`) |
| `cli.ts` | CLI entry point with arg parsing and JSON output |
| `cli-options.ts` | CLI argument parser |
| `batch.ts` | Batch processing with concurrency control |
| `io.ts` | Node file I/O (read files, write Markdown output, MIME mapping) |
| `node-compat.ts` | jsdom DOMParser injection into the runtime bridge |
| `types.ts` | npm-specific types (`ConvertOptions`, `DocumentResult`, `BatchResult`) |

**Cross-package import pattern:** `packages/core/src/batch.ts` imports directly from the root `src/converters/` directory using relative paths that cross the package boundary. The shared converter code is compiled into the npm package at build time by Vite's SSR bundler.

## Runtime Compatibility

The shared converters were originally written for the browser. Several converters use `DOMParser` (via `richText.ts`) and `FileReader` (via `readText.ts` and `readBinary.ts`), which are browser-native APIs not available in Node.

The runtime bridge solves this:

```
Browser path:
  getDomParser() → globalThis.DOMParser (native, always available)

Node path:
  ensureNodeCompat()                         [packages/core/src/node-compat.ts]
    → import("jsdom")
    → new JSDOM("").window.DOMParser
    → enableNodeCompat({ domParser })        [src/converters/runtime.ts]
  getDomParser() → injected jsdom DOMParser
```

**Key design points:**

- `runtime.ts` holds a module-scoped flag and DOMParser reference. It exposes `enableNodeCompat()`, `isNodeCompatEnabled()`, and `getDomParser()`.
- `node-compat.ts` lazily initializes jsdom once (memoized via a shared `Promise`) and injects the DOMParser into the runtime bridge.
- `readText.ts` and `readBinary.ts` check `isNodeCompatEnabled()` to choose between `FileReader` and direct `Blob` methods.
- The bridge is transparent to converter code: converters call `getDomParser()` and `readFileAsText()`/`readFileAsArrayBuffer()` without knowing which runtime they are in.

## Shared vs. Non-Shared Layers

| Layer | Shared | Web-Only | npm-Only |
|-------|--------|----------|----------|
| Converter logic (`/src/converters/`) | Yes | — | — |
| ConversionResult contract | Yes | — | — |
| Runtime bridge (`runtime.ts`) | Yes | — | — |
| React UI (`/src/components/`) | — | Yes | — |
| App entry and state (`/src/App.tsx`) | — | Yes | — |
| CLI and arg parsing | — | — | Yes |
| Batch processing with concurrency | — | — | Yes |
| Node file I/O (`io.ts`) | — | — | Yes |
| jsdom DOMParser shim (`node-compat.ts`) | — | — | Yes |
| npm types (`ConvertOptions`, `BatchResult`) | — | — | Yes |

## Client-Side Stack

The web UI uses these client-side libraries for in-browser document processing:

- **React + TypeScript + Vite** power the static frontend
- **mammoth** reads `.docx` content into semantic HTML for Markdown conversion
- **turndown** converts HTML-based input into Markdown
- **read-excel-file** handles spreadsheet parsing for `.xlsx`
- **pdfjs-dist** extracts selectable text from PDFs via a browser-side worker
- **jszip** supports `.pptx` archive inspection
- **react-markdown + remark-gfm** render the Markdown preview

## Privacy and Local Processing

- **Privacy-forward by default:** files are processed in-browser, not uploaded to a service.
- **Simple trust model:** no server-side storage, queue, or backend worker pipeline.
- **Honest scope:** the web surface is a static frontend utility, not a document-processing platform.

The npm package follows the same principle at the Node level: conversion runs locally, no data leaves the machine.

## Limits and Boundaries

- PDF support is best-effort and text-first; scanned or image-based PDFs are out of scope.
- PPTX support is experimental and intentionally conservative.
- The web UI has no backend API, server-side worker, queue, Redis, auth, telemetry, or server deployment path.
- A browser-side PDF.js worker is used for PDF parsing, but it runs locally in the user's browser and is not a separate service boundary.
- The npm package enforces a configurable batch limit (default 50 documents) via `BatchLimitExceededError`.
- If a server component is ever added, document that contract separately instead of stretching this reference beyond what the repo actually does.

## Deployment

- **Web UI:** Ships as a static Vite build and can be hosted on GitHub Pages or any equivalent static host.
- **npm package:** Published as `@doc2md/core` to the npm registry. Requires Node >= 22. Includes a `bin/doc2md.js` CLI entry point.

## See Also

- [Publishing @doc2md/core](publishing-doc2md-core.md) — release process and npm publishing workflow
- [Using @doc2md/core](using-doc2md-core.md) — consumer guide for the npm package API and CLI
