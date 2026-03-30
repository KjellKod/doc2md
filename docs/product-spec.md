# doc2md Product Specification

This document contains the full product specification, design principles, technical architecture, testing requirements, and scope boundaries for doc2md. It was originally the README and is preserved here as the detailed reference for contributors and agentic systems.

---

## Purpose

Build a **clean, simple, professional, board-level quality** web tool that converts supported document formats into Markdown (`.md`).

The tool should be easy for people who are new to AI-assisted workflows and want a frictionless way to take a file they already have — such as an Office document, PDF, spreadsheet, presentation, HTML file, text file, or JSON file — and turn it into Markdown for tools like Claude Code, coding agents, internal AI workflows, or general text-first editing.

This should feel like a **high-quality example project**:

* useful in practice
* easy to understand
* privacy-friendly
* technically elegant
* professional without being noisy

The core product story is:

> Drop in a file, convert it locally, review the result, and download Markdown.

## Product principles

1. **Client-side first** — Files are processed locally in the browser.
2. **Privacy-forward** — The default experience does not upload files to a server.
3. **Simple over clever** — Support common cases well rather than claiming perfect support for everything.
4. **Honest over magical** — Especially for PDFs, be explicit about limitations and output quality.
5. **Professional UX** — Clean, restrained, premium, trustworthy. No gimmicks.
6. **Markdown quality over styling fidelity** — Useful Markdown, not pixel-perfect reconstruction.
7. **Graceful failure** — Unsupported or low-quality conversions fail clearly and politely.

## Supported input formats

* `.md` — pass-through with normalization
* `.docx` — via mammoth.js + turndown
* `.xlsx` — via read-excel-file, one table per sheet
* `.pdf` — via PDF.js, text PDFs only, with quality detection
* `.csv` / `.tsv` — native parsing, Markdown tables
* `.pptx` — via JSZip XML parsing (experimental)
* `.html` — via turndown
* `.txt` — native, line ending normalization
* `.json` — pretty-printed fenced code block

## Mixed format support

Users can upload multiple files of different formats in one session. Each file converts independently with per-file status. One input file produces one output Markdown file.

## Scope boundaries

### In scope

* Client-side conversion for all 10 supported formats
* Mixed-format batch upload
* Per-file conversion status
* Markdown preview (react-markdown + remark-gfm)
* Markdown download
* Graceful feedback when conversion quality is limited
* Strong empty / loading / success / error states
* Premium but quiet UI

### Explicitly out of scope for v1

* Server-side conversion, OCR, scanned PDF support
* Password-protected files, macro-heavy Office files
* Old binary formats like `.doc`
* Image-to-Markdown extraction
* Collaborative editing, user accounts, storage, telemetry

## PDF philosophy

PDF is not a naturally semantic document format. PDF conversion is **best effort**, not guaranteed high fidelity.

**Good fit:** text-based PDFs, normal reading order, selectable text, simple structure.

**Poor fit:** scanned PDFs, image-only, complex tables, forms, multi-column layouts, footnotes.

When a PDF is uploaded, the system attempts text extraction, detects whether usable text exists, and warns clearly if extraction is weak or image-based. It never pretends the result is high quality when it is not.

### Feedback language

* "This PDF appears to contain little or no selectable text. Scanned/image-based PDFs are not supported in this version."
* "Conversion completed, but this PDF layout is likely to produce imperfect Markdown. Please review before use."

## Technical stack

* **React + TypeScript + Vite** — static frontend, GitHub Pages deployment
* **mammoth.js** — .docx to semantic HTML
* **turndown** — HTML to Markdown
* **read-excel-file** — .xlsx parsing
* **PDF.js** — PDF text extraction
* **JSZip** — .pptx unpacking
* **react-markdown + remark-gfm** — Markdown preview rendering

## UX direction

Clean, simple, impressive, professional. Board-level quality. Credible in front of executives, engineers, and design-aware product people.

**Tone:** calm, precise, competent, reassuring. No hype.

**Styling:** minimal, premium, restrained, enterprise-ready. No loud gradients, flashy animations, or consumer-app gimmicks.

## Error handling

Every failure mode produces feedback that is specific, actionable when possible, non-technical, and non-alarming.

| Scenario | Message |
|----------|---------|
| Unsupported format | "Unsupported file type. Please upload one of the supported formats." |
| Corrupt file | "We couldn't read this file. It may be corrupted or use a structure not supported by this tool." |
| Scanned PDF | "This PDF appears to be image-based. Scanned PDFs are not supported in this version." |
| Large file | "This file is too large for reliable in-browser conversion in this version." |

## Testing

See [docs/testing.md](testing.md) for the full testing strategy including unit tests, integration tests, smoke tests, and the manual review checklist.

## Non-goals

The tool is **not** trying to be a universal document converter, a PDF recovery system, an OCR platform, a cloud processing product, or a document storage service.
