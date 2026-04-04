# doc2md

<div align="center">

### ✦ [**Use doc2md live →**](https://kjellkod.github.io/doc2md/) ✦

*Client-side, private, no upload. Your files never leave your browser.*

</div>

---

A browser-based tool that converts documents to Markdown. Drop in a file, convert it locally, review the result, download `.md`.

Built for people entering AI-assisted workflows who need a frictionless way to turn existing documents into Markdown for tools like Claude Code, coding agents, or text-first editing.

**Supported formats:** `.md` `.docx` `.xlsx` `.pdf` `.csv` `.tsv` `.pptx` `.html` `.txt` `.json`

## Quick Start

**Run locally:**

```bash
git clone https://github.com/KjellKod/doc2md.git
cd doc2md
npm install
npm run dev
```

Open `http://localhost:5173/doc2md/` in your browser.

## Use As A Package Or CLI

If you want automation, batch jobs, MCP/server-side preprocessing, or a reusable function call, use the `@doc2md/core` workspace package.

```ts
import { convertDocuments } from "@doc2md/core";

const result = await convertDocuments(
  ["/absolute/path/resume.pdf", "/absolute/path/notes.docx"],
  {
    outputDir: "/absolute/path/out",
    maxDocuments: 10,
  },
);
```

The package writes markdown files to disk and returns structured metadata about each document.

See [Using `@doc2md/core`](docs/using-doc2md-core.md) for the current install story, API examples, CLI usage, and output contract.

## Principles

* **Client-side first** — files processed in the browser, never uploaded
* **Honest over magical** — PDFs degrade gracefully with clear warnings
* **Simple over clever** — common cases handled well, no fake completeness

## Architecture

doc2md is a browser-only tool: conversion runs on the device, output stays local, and there is no backend, server-side worker, or server path in the current product. The PDF converter does use a browser-side PDF.js worker as an implementation detail. See [docs/architecture.md](docs/architecture.md) for the bounded design and format limits.

## Documentation

* [Architecture Note](docs/architecture.md) — browser-only data flow, stack, limits, and deployment model
* [Using `@doc2md/core`](docs/using-doc2md-core.md) — Node/package usage, CLI usage, output contract, and current install path
* [Product Specification](docs/product-spec.md) — full design, architecture, scope, and UX direction
* [Provenance Guidance](docs/provenance.md) — lightweight attribution hygiene for future borrowed material
* [Testing Strategy](docs/testing.md) — test coverage, fixtures, and manual review checklist
* [Jean-Claude's Journal](docs/journal/) — engineering reflections from our resident platform agent
* [Dexter's Journal](docs/dexter-journal/) — the other perspective

---

## License

This project is licensed under the [MIT License](LICENSE).

**doc2md** is built with [Quest](https://github.com/KjellKod/quest/blob/main/README.md) — vetted by [Dexter](docs/dexter-journal/) and narrated by [Jean-Claude](docs/journal/), for a deliberate and robust engineering tool. An initiative through CandidTalentEdge.
