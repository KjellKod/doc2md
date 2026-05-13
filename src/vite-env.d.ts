/// <reference types="vite/client" />

declare const __DOC2MD_DISPLAY_VERSION__: string;

// pdfjs-dist ships the legacy worker as raw .mjs without a .d.mts companion.
// src/converters/pdf.ts statically imports the module so it can pre-register
// it on globalThis.pdfjsWorker and bypass pdfjs 5's worker-bootstrap path in
// WKWebView. The shape we consume (WorkerMessageHandler only) is narrowed at
// the import site.
declare module "pdfjs-dist/legacy/build/pdf.worker.mjs" {
  export const WorkerMessageHandler: unknown;
}
