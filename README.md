# doc2md

<div align="center">

### ✦ [**Use doc2md live →**](https://kjellkod.github.io/doc2md/) ✦

*Client-side, private, no upload. Your files never leave your browser.*

</div>

---

A browser-based tool that converts documents to Markdown. Drop in a file, convert it locally, review the result, download `.md`.

Built for people entering AI-assisted workflows who need a frictionless way to turn existing documents into Markdown for tools like Claude Code, coding agents, or text-first editing.

**Supported formats:** `.docx` `.xlsx` `.pdf` `.csv` `.tsv` `.pptx` `.html` `.txt` `.json`

## Quick Start

**Run locally:**

```bash
git clone https://github.com/KjellKod/doc2md.git
cd doc2md
npm install
npm run dev
```

Open `http://localhost:5173/doc2md/` in your browser.

## Principles

* **Client-side first** — files processed in the browser, never uploaded
* **Honest over magical** — PDFs degrade gracefully with clear warnings
* **Simple over clever** — common cases handled well, no fake completeness

## Documentation

* [Product Specification](docs/product-spec.md) — full design, architecture, scope, and UX direction
* [Testing Strategy](docs/testing.md) — test coverage, fixtures, and manual review checklist
* [Jean-Claude's Journal](docs/journal/) — engineering reflections from our resident agent

---

**doc2md** is an initiative through CandidTalentEdge and developed with [Quest](https://github.com/KjellKod/quest/blob/main/README.md)
