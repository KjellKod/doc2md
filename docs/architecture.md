---
title: Browser-Only Architecture
purpose: Explain the browser-only data flow, client-side stack, and intentional architecture boundaries for doc2md.
audience: Contributors and maintainers
scope: Frontend architecture and deployment boundaries
status: active
owner: maintainers
---

# Browser-Only Architecture

doc2md is deliberately narrow: it converts supported documents to Markdown in the browser and keeps the normal flow local to the user's device.

## Why Files Stay Local

- Privacy-forward by default: files are processed in-browser, not uploaded to a service.
- Simpler trust model: no server-side storage, queue, or backend worker pipeline to explain away.
- Honest scope: this repo is a static frontend utility, not a document-processing platform.

## Data Flow

1. The user drops one or more supported files into the React UI.
2. The browser selects the matching client-side converter for each file type.
3. The converter returns Markdown plus any warnings about quality or limits.
4. The user reviews the result locally and downloads a `.md` file.

## Client-Side Stack

- React + TypeScript + Vite power the static frontend.
- `mammoth` reads `.docx` content into semantic HTML for Markdown conversion.
- `turndown` converts HTML-based input into Markdown.
- `read-excel-file` handles spreadsheet parsing for `.xlsx`.
- `pdfjs-dist` extracts selectable text from PDFs via a browser-side worker.
- `jszip` supports `.pptx` archive inspection.
- `react-markdown` + `remark-gfm` render the preview.

## Limits And Boundaries

- PDF support is best-effort and text-first; scanned or image-based PDFs are out of scope.
- PPTX support is experimental and intentionally conservative.
- There is no backend API, server-side worker, queue, Redis, auth, telemetry, or server deployment path in the current product.
- A browser-side PDF.js worker is used for PDF parsing, but it runs locally in the user's browser and is not a separate service boundary.
- If a server component is ever added, document that contract separately instead of stretching this note beyond what the repo actually does.

## Deployment

The app ships as a static Vite build and can be hosted on GitHub Pages or any equivalent static host.
