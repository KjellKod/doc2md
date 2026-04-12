# Docling-Studio vs doc2md: Comparative Analysis

**Date:** 2026-04-12
**Quest:** `docling-studio-comparison_2026-04-11__2157`

## Executive Summary

- **Fundamentally different architectures solving adjacent problems.** doc2md is a privacy-first multi-format converter (10 formats, browser + Node.js CLI + API, no server required). Docling-Studio is a client-server PDF analysis studio powered by ML (OCR, tables, formulas, bounding boxes). They overlap only on "document to markdown" — everything else diverges.
- **Docling-Studio has significantly more process maturity.** 12 audit templates, 19 documented processes, a 4-phase release gate with 10 automated checks, Karate e2e suites with tag-based gating, and structured deployment checklists. This is enterprise-grade governance.
- **doc2md has a stronger distribution story.** Browser UI, npm CLI, programmatic API, and portable agent skill — four consumption modes from one codebase, with zero infrastructure requirements. Docling-Studio requires Docker.
- **Neither project is "better" — they're optimized for different trust models.** doc2md: "your files never leave your browser." Docling-Studio: "upload your PDF and we'll run ML models on it." Both are valid; the choice depends on the user's context.
- **There are concrete takeaways for doc2md's roadmap**, particularly around e2e testing patterns, optional backend for enhanced PDF quality, and the hexagonal architecture pattern for `@doc2md/core`.

---

## Not Apple-to-Apple: Framing the Comparison

This comparison must be read with a critical structural disclaimer: **these projects solve different problems with fundamentally different architectures.**

| Dimension | doc2md | Docling-Studio |
|-----------|--------|----------------|
| **Processing model** | Client-side (browser/Node) | Client-server (FastAPI + Vue) |
| **Trust model** | Zero-upload, privacy-first | Server upload required |
| **Format scope** | 10 formats (breadth) | PDF-only (depth) |
| **ML involvement** | None — text extraction only | Docling library: OCR, table detection, formula recognition |
| **Infrastructure** | Static site / npm package | Docker stack with SQLite persistence |

Every axis below must be interpreted through this lens. When Docling-Studio has "better architecture," it's partly because a client-server app *needs* more architecture. When doc2md has "simpler deployment," it's partly because a static site *can be* simpler.

The user noted: *"we could be for the npm part if we wanted"* — meaning `@doc2md/core` could theoretically add a backend component. That bridge is explored in the roadmap section.

---

## Quick Comparison Table

| Attribute | doc2md | Docling-Studio |
|-----------|--------|----------------|
| **Language** | TypeScript (strict) | Python 3.12 + TypeScript (strict) |
| **Frontend** | React + Vite | Vue 3 + Vite + Pinia |
| **Backend** | None | FastAPI + SQLite |
| **Input formats** | 10 (md, docx, xlsx, pdf, csv, tsv, pptx, html, txt, json) | PDF only |
| **Output** | Markdown | Markdown + HTML + bounding boxes + chunks |
| **PDF approach** | PDF.js text extraction with quality detection | Docling ML: OCR, table extraction, formula recognition |
| **LoC** | ~11,100 TypeScript | ~15,000 (Python + TypeScript + Vue) |
| **Unit tests** | 37 files, 5,321 lines (Vitest) | 199 backend (pytest) + 129 frontend (Vitest) |
| **E2E tests** | 15 converter smoke tests (no browser e2e) | 31 Karate feature files (API + UI) |
| **Coverage config** | No thresholds | No thresholds found |
| **CI workflows** | 5 (lint, test, build, deploy, security) | 6 (CI, release-gate, release, docs, compat, auto-close) |
| **Release gate** | lint + typecheck + test + build | 10 checks in 4 phases + PR verdict comment |
| **Deployment** | GitHub Pages static site | Docker (remote ~270MB, local ~1.9GB) |
| **i18n** | No | FR/EN |
| **Theme** | Light/Dark | Light/Dark |
| **Feature flags** | No | Yes (engine-based: chunking, disclaimer) |
| **Persistence** | None (stateless) | SQLite (documents, analyses, history) |
| **Concurrency control** | Promise queue (max 3) | asyncio.Semaphore (max 3) |
| **Version** | 1.0.1 | 0.3.1 |
| **License** | MIT | Apache 2.0 |

---

## 1. Strategy

### doc2md: Frictionless Multi-Format Conversion for AI Workflows

doc2md's strategy is stated plainly in `docs/product-spec.md`: a **browser-based tool for converting documents to Markdown**, optimized for people entering AI-assisted workflows (Claude Code, Codex, coding agents).

**Core strategic bets:**
- **Client-side first** — files processed locally in browser, zero server trust
- **Format breadth over depth** — 10 formats, "good enough" extraction for all of them
- **Honest scope** — explicitly acknowledges PDF limitations (scanned PDFs get quality warnings, not fake completeness)
- **Multi-surface distribution** — browser UI, `@doc2md/core` npm CLI, programmatic API, portable `.skills/` agent wrapper

The product principles (`docs/product-spec.md:25-32`) are disciplined: "Simple over clever," "Honest over magical," "Markdown quality over styling fidelity." This is a tool that knows what it is.

**Growth vector:** npm ecosystem + agent skill portability. The `@doc2md/core` package (`packages/core/package.json`) provides `convertDocuments()` and `convertDocument()` APIs with batch processing, concurrency control, and a CLI. The `.skills/doc2md/` wrapper makes doc2md callable from any agent workflow.

### Docling-Studio: Visual PDF Analysis Platform

Docling-Studio's README positions it as a **visual document analysis studio powered by Docling ML** — upload a PDF, configure the extraction pipeline, visualize results with bounding boxes, export markdown/HTML.

**Core strategic bets:**
- **PDF depth over format breadth** — one format, powered by ML (OCR, table extraction, formula recognition, picture classification)
- **Visual analysis** — bounding box overlays, per-page results, color-coded element types
- **Dual deployment modes** — remote (~270MB, delegates to Docling Serve) and local (~1.9GB, runs ML in-process)
- **Enterprise governance** — 12 audit templates, 19 documented processes, release gates, security SLAs

**Growth vector:** Docker/enterprise deployment. Multi-arch images (amd64 + arm64), semantic versioning with 6 Docker tags per release, deployment checklists with rollback triggers.

### Strategic Comparison

doc2md optimizes for **zero-friction adoption** (drag a file into a browser, get markdown). Docling-Studio optimizes for **analysis quality** (ML-powered extraction with visual verification). doc2md is a utility; Docling-Studio is a workbench.

---

## 2. Test Approach

### doc2md: Unit-Heavy, No E2E

**Test inventory:** 37 test files, 5,321 lines of test code, Vitest 4.1.2.

**Test pyramid:** Strong unit tests plus a smoke test suite (`src/__tests__/smoke.test.ts`, 248 lines, 15 cases) that exercises every format end-to-end through the converter pipeline — including real fixture files (.docx, .xlsx, .pdf, .pptx), batch conversion, 10-PDF concurrent conversion, and error paths (unsupported format, empty file, malformed input). These are reliable converter-level e2e tests, not browser automation tests.

**Testing style** — co-located test files, direct assertion on converter outputs:

```typescript
// src/converters/csv.test.ts
it("converts CSV with headers to a Markdown table", async () => {
  const file = new File(
    ["name,role,team\nJean-Claude,Planner,Quest\nDexter,Builder,Quest"],
    "sample.csv",
    { type: "text/csv" }
  );
  const result = await convertCsv(file);
  expect(result).toEqual({
    markdown: "| name | role | team |\n| --- | --- | --- |\n| Jean-Claude | Planner | Quest |\n| Dexter | Builder | Quest |",
    warnings: [],
    status: "success"
  });
});
```

**Hook/state testing** — uses `@testing-library/react` with fake timers for async behavior:

```typescript
// src/hooks/useFileConversion.test.ts
it("sets error with timeout message when a converter hangs", async () => {
  vi.useFakeTimers();
  convertFileMock.mockImplementation(() => new Promise(() => {}));
  const { result } = renderHook(() => useFileConversion());
  act(() => { result.current.addFiles([createFile("hung.txt")]); });
  await act(async () => { await vi.advanceTimersByTimeAsync(CONVERSION_TIMEOUT_MS); });
  expect(result.current.entries[0]?.status).toBe("error");
});
```

**Fixtures:** 22 static test files in `test-fixtures/` covering all formats plus edge cases (scanned PDF, empty file, malformed JSON). PDF golden file snapshots in `sample.pdf.browser-golden.json`.

**Coverage:** No explicit thresholds or coverage configuration found. Testing strategy doc exists at `docs/testing.md` but does not mandate coverage percentages.

**CI gating:** `npm test -- --run` must pass. No coverage gate.

### Docling-Studio: Three-Layer Testing with E2E

**Test inventory:**
- **Backend:** 199 tests in 13 files, 3,789 lines (pytest, `asyncio_mode=auto`)
- **Frontend:** 129 tests in 15 files (Vitest)
- **E2E:** 31 Karate feature files (API + UI suites)

**Backend testing style** — async-first with mocked ports:

```python
# tests/test_analysis_service.py
@pytest.mark.asyncio
async def test_exception_marks_job_failed(self):
    service = _make_service()
    async def failing_task():
        raise RuntimeError("unexpected failure")
    task = asyncio.create_task(failing_task())
    await asyncio.sleep(0)
    with patch.object(service, "_mark_failed", new_callable=AsyncMock) as mock_mark:
        service._on_task_done(task, job_id="job-123")
        await asyncio.sleep(0)
    mock_mark.assert_called_once_with("job-123", "unexpected failure")
```

**Domain model state machine testing** — guard clauses verified:

```python
# tests/test_models.py
def test_mark_running_from_running_raises(self):
    job = AnalysisJob()
    job.mark_running()
    with pytest.raises(ValueError, match="Cannot mark as RUNNING"):
        job.mark_running()
```

**Frontend testing** — Pinia store setup with mocked HTTP:

```typescript
// src/features/feature-flags/store.test.ts
it('enables chunking when engine is local', async () => {
  mockApiFetch.mockResolvedValue({ status: 'ok', engine: 'local' })
  const store = useFeatureFlagStore()
  await store.load()
  expect(store.isEnabled('chunking')).toBe(true)
})
```

**E2E: Karate with strict conventions** (`e2e/CONVENTIONS.md`):
- **Golden rules:** Never use `Thread.sleep()` — use `retry()`/`waitFor()`. Never use CSS classes — use `data-e2e` attributes. Setup via API, verify via UI, cleanup via API.
- **Tag-based gating:**

| Tag | Scope | When |
|-----|-------|------|
| `@smoke` | API health checks | Every PR |
| `@regression` | Full API coverage | PR to `release/*` |
| `@e2e` | Cross-domain workflows | PR to `release/*` |
| `@critical` | 5 core UI journeys | CI on `main` |

This means PRs get fast `@smoke` checks, release branches get full regression, and `main` gets critical UI validation. Smart tiering.

**Coverage:** No explicit thresholds found in either `pyproject.toml` or vitest config.

### Test Approach Comparison

| Aspect | doc2md | Docling-Studio |
|--------|--------|----------------|
| Unit test count | ~158 across 37 files | 328 across 28 files |
| E2E tests | 15 converter smoke tests (no browser e2e) | 31 Karate features (API + browser) |
| Test pyramid shape | Unit-heavy + converter smoke | Balanced (unit + integration + e2e) |
| Async testing | Fake timers + renderHook | pytest.mark.asyncio + AsyncMock |
| Fixture approach | Static files (22) | Static + generated (`generate-test-data.py`) |
| CI test gating | Single pass (all tests) | Tiered by branch (`@smoke` vs `@regression`) |
| Coverage enforcement | None | None |

**Verdict:** Docling-Studio has a more mature test strategy, especially the browser e2e layer and the tag-based CI gating. doc2md's converter smoke tests are reliable and cover all formats end-to-end including concurrency, but it lacks browser-level UI automation (Playwright/Cypress). The smoke suite is a genuine strength — not "no e2e" — but it doesn't test drag-and-drop, UI rendering, or user flows.

---

## 3. Code Quality and Architecture

### doc2md: Simple, Flat, Functional

**Architecture pattern:** Converter registry with functional dispatch. No formal architecture pattern name — it's just well-organized TypeScript.

```typescript
// src/converters/index.ts — the entire routing layer
const converters: Record<SupportedFormat, Converter> = {
  csv: convertCsv, docx: convertDocx, html: convertHtml,
  json: convertJson, md: convertMd, pdf: convertPdf,
  pptx: convertPptx, tsv: convertTsv, txt: convertTxt, xlsx: convertXlsx
};

export async function convertFile(file: File): Promise<ConversionResult> {
  const extension = getFileExtension(file.name);
  if (!isSupportedFormat(extension)) {
    return createErrorResult(UNSUPPORTED_FILE_MESSAGE);
  }
  return converters[extension](file);
}
```

**Type system:** TypeScript strict mode, clean result types:

```typescript
// src/converters/types.ts
export interface ConversionResult {
  markdown: string;
  warnings: string[];
  status: ConversionResultStatus;  // "success" | "warning" | "error"
  quality?: ConversionQuality;     // PDF-specific quality metadata
}
export type Converter = (file: File) => Promise<ConversionResult>;
```

**State management:** React hooks (`useState`), no external state library. Single `useFileConversion()` hook manages the entire file list with concurrency control (max 3 parallel conversions via promise queue, 30s timeout, 100MB file size limit).

**Linting:** ESLint + `tseslint.configs.recommended` + React hooks plugin. TypeScript strict mode with `noEmit`, `isolatedModules`, `forceConsistentCasingInFileNames`. No Prettier configured.

**Coding standards** (`AGENTS.md`): Enforces KISS, DRY, YAGNI, and SRP as core principles. Change philosophy: prefer minimal focused changes, avoid broad refactors unless they fix real bugs, don't add "improvements" that weren't requested. Testing expectations: bug fixes require a reproducing test first, mock at boundaries not internals. Security hygiene: no secrets in code/logs, input validation at trust boundaries. These standards are enforced by the agentic CI pipeline — both Jean-Claude and [Dexter](../dexter-journal/019-requiem-docling-studio-comparison.md) personas apply them during [Quest](https://github.com/KjellKod/Quest) plan review, code review, and implementation.

**Monorepo structure:** Workspace root with browser app (`src/`) and `@doc2md/core` package (`packages/core/`). Core package has its own vitest config targeting Node environment.

**Strengths:** The codebase is simple, readable, and appropriate for its scope. Converters are pure functions with clear input/output contracts. No over-engineering.

**Weaknesses:** No formal separation of concerns beyond the `converters/` directory. No dependency injection, no ports/adapters — but also no need for them at this scale.

### Docling-Studio: Hexagonal Architecture with Ports/Adapters

**Architecture pattern:** Clean/Hexagonal architecture with explicit layers:

```
domain/     → Pure data structures + state machines (zero external imports)
  ├── models.py      → Document, AnalysisJob dataclasses
  ├── ports.py        → Protocol-based interfaces (DocumentConverter, DocumentChunker, *Repository)
  └── value_objects.py → ConversionResult, PageDetail, ChunkResult

services/   → Use case orchestration (depends on domain only)
  ├── analysis_service.py  → Async conversion + chunking + progress tracking
  └── document_service.py  → Upload, delete, preview

api/        → HTTP layer (FastAPI routers + Pydantic DTOs)
  ├── schemas.py      → Request/response models (camelCase serialization)
  ├── analyses.py     → /api/analyses endpoints
  └── documents.py    → /api/documents endpoints

persistence/ → Data layer (SQLite via aiosqlite)
  ├── document_repo.py  → Document CRUD
  └── analysis_repo.py  → AnalysisJob CRUD

infra/      → Infrastructure adapters
  ├── local_converter.py   → In-process Docling (threaded)
  ├── serve_converter.py   → HTTP client for remote Docling Serve
  ├── local_chunker.py     → In-process chunking
  └── settings.py          → Environment-based configuration
```

**Port definitions** — Python `Protocol` (duck-typed, no inheritance):

```python
# domain/ports.py
class DocumentConverter(Protocol):
    async def convert(self, file_path: str, options: ConversionOptions,
                      *, page_range: tuple[int, int] | None = None) -> ConversionResult: ...

class DocumentChunker(Protocol):
    async def chunk(self, document_json: str, options: ChunkingOptions) -> list[ChunkResult]: ...
```

**Dependency injection at bootstrap** — concrete adapters selected by environment:

```python
# main.py
def _build_converter():
    if settings.conversion_engine == "remote":
        return ServeConverter(base_url=settings.docling_serve_url, ...)
    else:
        return LocalConverter()
```

**Domain model state machine** — guard clauses prevent invalid transitions:

```python
# domain/models.py
def mark_running(self) -> None:
    if self.status != AnalysisStatus.PENDING:
        raise ValueError(f"Cannot mark as RUNNING from {self.status}")
    self.status = AnalysisStatus.RUNNING
    self.started_at = _utcnow()
```

**Frontend:** Feature-based organization (6 features: analysis, document, history, settings, feature-flags, chunking). Pinia stores, Composition API only (`<script setup lang="ts">`), type-based props (`defineProps<T>()`).

**Coding standards** (`docs/architecture/coding-standards.md`): Max function length 30 lines (soft), max file length 300 lines, type hints on all public functions, domain layer must have zero imports from api/persistence/infra.

**Linting:** Backend: Ruff with 10 rule categories (E, W, F, I, N, UP, B, SIM, TCH, RUF), line-length 100. Frontend: ESLint + TypeScript ESLint + Vue plugin, `no-console` warned, `no-debugger` errored.

### Architecture Comparison

| Aspect | doc2md | Docling-Studio |
|--------|--------|----------------|
| Pattern | Functional registry | Hexagonal (ports/adapters) |
| Layers | converters / hooks / components | domain / services / api / persistence / infra |
| DI | None needed | Constructor injection via bootstrap |
| Type safety | TS strict + `ConversionResult` | TS strict + Pydantic + Protocol classes |
| State management | React hooks (no library) | Pinia stores (one per feature) |
| Coding standards doc | Yes (`AGENTS.md`: KISS, DRY, YAGNI, SRP, testing, security) | Yes (`docs/architecture/coding-standards.md`: 30-line fn limit, 300-line file limit) |
| Architecture doc | Yes (`docs/architecture.md`) | Yes (`docs/architecture.md` + ADR guide) |

**Verdict:** Docling-Studio's architecture is significantly more formal, but proportional to its complexity. doc2md's architecture is appropriate for a browser utility. The hexagonal pattern is the most transferable lesson — particularly for `@doc2md/core`.

---

## 4. Use Cases

### doc2md Use Cases

1. **One-off document conversion** — Drag a file into the browser, get markdown. No install, no account, no upload. Target: anyone entering an AI-assisted workflow.
2. **Batch CLI conversion** — `doc2md *.pdf *.docx -o ./out` (global install) or `npx doc2md *.pdf *.docx -o ./out` (no install) for converting document collections. Use `npx` for one-off runs without installing; use `doc2md` directly after `npm install -g` for frequent use. Target: developers, technical writers.
3. **Programmatic API** — `import { convertDocuments } from "@doc2md/core"` for integrating into Node.js pipelines. Target: toolchain builders.
4. **Agent skill** — Portable `.skills/doc2md/` wrapper for coding agents. In Claude Code: `/doc2md convert the quarterly reports in ./docs/finance to markdown for the AI review pipeline`. Target: agentic workflows.

**Key characteristic:** Four consumption surfaces from one codebase, zero infrastructure for any of them.

### Docling-Studio Use Cases

1. **Visual PDF analysis** — Upload a PDF, configure pipeline options (OCR, table extraction, formula enrichment), view bounding box overlays per page. Target: document processing professionals, researchers.
2. **Quality verification** — Visual bounding box overlay lets users verify ML extraction quality before using the output. Target: anyone who needs to trust the extraction.
3. **Document chunking** — Re-chunk completed analyses with different options for RAG pipelines. Target: LLM/RAG developers.
4. **Analysis history** — Persist and revisit past analyses. Target: teams doing repeated document processing.
5. **Remote processing proxy** — Lightweight Docker image delegates to a Docling Serve cluster. Target: enterprises with existing Docling infrastructure.

All interaction is through the web UI — there is no CLI, no npm package, and no documented API for scripting. The REST API exists (`/api/documents`, `/api/analyses`) but is internal to the frontend, not a published consumption surface.

**Key characteristic:** Deep PDF analysis with visual verification, requiring infrastructure and a browser.

### Use Case Overlap

The overlap is narrow: both convert PDFs to markdown. But doc2md does text extraction (PDF.js) while Docling-Studio does ML analysis (OCR, table detection, formula recognition). A scanned PDF that gets a "poor quality" warning in doc2md would get full OCR extraction in Docling-Studio.

For the other 9 formats doc2md supports (docx, xlsx, csv, tsv, pptx, html, txt, json, md), Docling-Studio has no equivalent.

---

## 5. Direct Comparison

| Dimension | doc2md | Docling-Studio | Edge |
|-----------|--------|----------------|------|
| Format breadth | 10 formats | PDF only | **doc2md** |
| PDF extraction quality | Text extraction (PDF.js) | ML: OCR + tables + formulas + bbox | **DS** |
| Privacy model | Zero-upload, no server required | Requires server upload | **doc2md** |
| Deployment complexity | `npm install` or browser bookmark | Docker Compose + optional Docling Serve | **doc2md** |
| Time-to-value | Drop file → instant markdown | Docker pull → wait for ML models → upload → wait for analysis | **doc2md** |
| Architecture formality | Functional registry, clean but informal | Hexagonal with ports/adapters, documented standards | **DS** |
| Test maturity | Strong unit tests, no e2e | Unit + integration + e2e (Karate) with tag-based CI | **DS** |
| CI/CD maturity | 4-job parallel CI | 4-phase release gate with 10 checks + PR verdict | **DS** |
| Process documentation | Minimal (testing.md, architecture.md) | 19 processes, 12 audit templates, deployment checklists | **DS** |
| Distribution surface | Browser + CLI + API + agent skill | Docker images (2 variants) | **doc2md** |
| Persistence | Stateless | SQLite (documents, analyses, history) | **DS** |
| i18n | No | FR/EN | **DS** |
| Dependency weight | Lightweight JS libs (~50MB node_modules) | 270MB (remote) / 1.9GB (local) Docker images | **doc2md** |
| Scanned PDF handling | Quality warning ("poor") | Full OCR extraction | **DS** |
| Visual output | Plain markdown text | Markdown + HTML + bounding box overlays | **DS** |
| Concurrency model | Promise queue (browser) | asyncio.Semaphore + batched page processing | **DS** |
| npm ecosystem | Published package + CLI + skill | None | **doc2md** |

**Score by category:** doc2md leads on accessibility, distribution, and privacy. Docling-Studio leads on quality, architecture, testing, and process maturity.

---

## 6. Where Docling-Studio Is Better

### 6.1 PDF Analysis Quality
The fundamental advantage. Docling-Studio uses Docling's ML pipeline for OCR, table structure extraction, formula recognition, and picture classification. A scanned PDF, a table-heavy financial report, or a LaTeX-rendered paper all produce structured output. doc2md's PDF.js approach extracts selectable text only — scanned pages get a "poor quality" warning and empty output.

**Evidence:** `document-parser/infra/local_converter.py` wraps `docling.document_converter.DocumentConverter` with element type mapping for text, table, picture, formula, code, list, caption, header, footer, footnote. doc2md's `src/converters/pdf.ts` (1,431 lines) does heroic work with PDF.js text extraction and quality heuristics, but it's fundamentally limited by what PDF.js can extract.

### 6.2 Backend Architecture
The hexagonal pattern with Protocol-based ports (`domain/ports.py`) and injectable adapters (`infra/local_converter.py`, `infra/serve_converter.py`) is textbook clean architecture. The domain layer has zero imports from HTTP, database, or infrastructure code. State transitions on `AnalysisJob` have guard clauses. The `AnalysisService` orchestrates without implementing business logic.

doc2md doesn't need this level of architecture, but `@doc2md/core` might benefit from it as it grows.

### 6.3 E2E Testing with Karate
31 feature files with strict conventions, tag-based gating, and a clear separation between API and UI tests. The `e2e/CONVENTIONS.md` is a model document — golden rules against `Thread.sleep()`, mandatory `data-e2e` attributes, "setup via API / verify via UI / cleanup via API" pattern.

doc2md has 15 converter smoke tests that exercise every format through real fixtures, including 10-PDF concurrent conversion — but no browser-level UI automation. The smoke suite is reliable for converter correctness; the gap is in testing user flows (drag-and-drop, preview rendering, download).

### 6.4 Release Process Maturity
The 4-phase release gate (`release-gate.yml`) validates lint, tests, Docker builds, Docker smoke tests, Trivy image scans, e2e API tests, and e2e UI tests before posting a GO/NO-GO verdict as a PR comment. The 12-audit framework with weighted scoring and CRITICAL/MAJOR/MINOR levels is thorough.

doc2md's CI gates on lint + typecheck + test + build — solid but simpler.

### 6.5 Bounding Box Visualization
Users can visually verify extraction quality by seeing color-coded bounding boxes overlaid on the original PDF pages. This builds trust in the output. doc2md has no equivalent — users see markdown output and must trust it.

### 6.6 i18n and Feature Flags
Docling-Studio ships with FR/EN localization (`frontend/src/shared/i18n.ts`) and engine-based feature flags (chunking enabled only in local mode). doc2md has neither.

### 6.7 Document Persistence and History
SQLite-backed storage of documents and analyses with history navigation. Users can revisit past analyses. doc2md is stateless — close the tab, lose the output.

---

## 7. Where doc2md Is Better

### 7.1 Format Breadth
10 formats vs 1. doc2md converts docx, xlsx, pdf, csv, tsv, pptx, html, txt, json, and md. Docling-Studio only handles PDF. For a user with a mixed-format document collection, doc2md is the only option.

### 7.2 Privacy and Trust Model
"Files never leave your browser" is a powerful statement. Zero server, zero upload, zero telemetry. doc2md can process confidential documents without any trust decision. Docling-Studio requires uploading files to a server (even if self-hosted).

**Evidence:** `docs/architecture.md:14-19` explicitly documents the trust model: "No backend, server-side worker, queue, Redis, auth, or telemetry."

### 7.3 Deployment Simplicity
doc2md is a static site. Visit a URL, use it. Or `npm install -g @doc2md/core` for the CLI. Or copy `.skills/doc2md/` into a repo.

Docling-Studio requires `docker compose up`, port mapping, volume mounts, and in local mode, a 1.9GB image with a ~400MB ML model download on first run.

### 7.4 Time-to-Value
doc2md: drag a file → instant markdown. Under 1 second for text files, a few seconds for PDFs.

Docling-Studio: Docker pull (270MB-1.9GB) → start stack → wait for health check → upload file → wait for ML analysis → view results. Minutes minimum, potentially much longer for large PDFs.

### 7.5 NPM/Agent Ecosystem
`@doc2md/core` provides a published npm package with CLI, programmatic API, batch processing (concurrency control, max document limits), and a portable agent skill. This is four consumption surfaces from one codebase.

Docling-Studio has no npm package, no CLI, no agent integration. It's a web app.

```typescript
// @doc2md/core API — this doesn't exist in Docling-Studio's world
import { convertDocuments } from "@doc2md/core";
const result = await convertDocuments(
  ["/path/resume.pdf", "/path/notes.docx"],
  { outputDir: "/path/out", maxDocuments: 10, concurrency: 4 }
);
```

### 7.6 Dependency Weight
doc2md's browser build is a Vite-bundled static site. The `@doc2md/core` package depends on jszip, jsdom, mammoth, pdfjs-dist, read-excel-file, and turndown — all lightweight JS libraries.

Docling-Studio's local Docker image is 1.9GB and includes PyTorch (CPU), Docling ML models (~400MB downloaded at runtime), poppler-utils, and Nginx. The remote image is 270MB but requires a separate Docling Serve instance.

### 7.7 Honest Scope Communication
doc2md's product principles explicitly state: "Honest over magical — explicit about PDF limitations." Scanned PDFs get a quality indicator (`PdfQualityIndicator.tsx`) with "good" / "review" / "poor" levels. The tool tells you when it can't do a good job, rather than producing bad output silently.

This is a design philosophy difference, not a technical limitation — but it's a genuine user experience advantage for the cases where ML isn't needed.

### 7.8 Performance (Latency)

We did not run Docling-Studio's stack to benchmark it, but the codebase's own timeout defaults and architectural choices reveal significant performance concerns with ML-powered conversion:

**Default timeout cascade** (`document-parser/infra/settings.py`):
- `document_timeout`: **120 seconds** per document (Docling-level)
- `lock_timeout`: **300 seconds** (5 min to acquire the converter lock)
- `conversion_timeout`: **900 seconds** (15 min overall job ceiling)
- Docling Serve HTTP timeout: **600 seconds** (10 min for remote mode)

That's a **15-minute budget** for a single PDF. You don't set a 15-minute timeout if your conversions take seconds.

**Single-threaded bottleneck:** The local converter uses a global `threading.Lock()` (`local_converter.py:51`) because Docling's converter is not thread-safe. Despite the service allowing 3 concurrent analyses via `asyncio.Semaphore`, only one can actually use the ML converter at a time. The others queue behind the lock with a 5-minute acquisition timeout.

**Batching as a workaround:** The `_run_batched_conversion()` method in `analysis_service.py:163-221` converts large PDFs in page-range chunks with per-batch progress tracking. This exists specifically because processing an entire large PDF in one pass risks hitting the timeout ceiling. v0.3.1's changelog highlights "segmented progress bar, ring indicator, per-batch visual feedback" — you don't build progress UX for fast operations.

**Likely improvements Docling-Studio could make:**
- **GPU acceleration.** The Docker image uses CPU-only PyTorch (`--index-url https://download.pytorch.org/whl/cpu` in the Dockerfile). A GPU-enabled variant would dramatically reduce inference time for OCR and table detection.
- **Converter pooling.** Replace the single global lock with a pool of N converter instances, allowing true parallel processing. Memory-expensive but would remove the serialization bottleneck.
- **Selective pipeline.** The pipeline has toggles for OCR, table structure, formula enrichment, code enrichment, and picture classification — but they're all-or-nothing per analysis. A "fast mode" that skips expensive enrichments (formulas, picture classification) for documents that don't need them would reduce latency significantly.
- **Warm model caching.** First-run model download is ~400MB. Pre-baking models into the Docker image (instead of downloading at runtime) would eliminate cold-start latency.

**doc2md's comparison:** 30-second timeout (`src/hooks/useFileConversion.ts`). PDF.js text extraction completes in seconds. The tradeoff is clear — Docling-Studio trades latency for extraction quality. For interactive single-document workflows, doc2md's instant response is a material advantage. For batch processing of scanned archives where quality matters more than speed, Docling-Studio's approach is justified.

---

## 8. Takeaway Learnings and Roadmap Possibilities

### 8.1 Patterns Worth Adopting

**E2E test conventions.** Docling-Studio's `e2e/CONVENTIONS.md` is a template worth stealing wholesale. The "no sleep, use retry/waitFor" rule, `data-e2e` attribute requirement, and "setup via API / verify via UI / cleanup via API" pattern would make e2e tests reliable from day one if doc2md ever adds them. The tag-based gating (`@smoke` for PRs, `@regression` for releases) is a smart CI optimization.

**Release gate with PR verdicts.** The `release-gate.yml` pattern of running a multi-phase validation and posting a GO/NO-GO comment to the PR is a lightweight but powerful quality gate. doc2md could adopt this without the full 12-audit framework.

**Coding standards document.** The 30-line function limit, 300-line file limit, and explicit layer dependency rules in `docs/architecture/coding-standards.md` are worth codifying for doc2md. Not as enforcement, but as documented expectations.

**State machine on domain models.** The `AnalysisJob.mark_running()` pattern with guard clauses is clean and testable. If doc2md ever adds stateful processing (e.g., conversion history, queue management), this is the pattern to use.

### 8.2 Concrete Roadmap Possibilities

#### Possibility 1: Optional Backend for Enhanced PDF Quality
**What:** Add an optional server-side mode to `@doc2md/core` that uses Docling (or Docling Serve) for ML-powered PDF processing.

**How it maps to the "npm part":** Today, `@doc2md/core` runs PDF.js in Node.js — same text extraction as the browser. An optional backend could call Docling Serve via HTTP (like DS's `ServeConverter`) to get OCR, table extraction, and formula recognition. The core package API stays the same; only the PDF converter implementation changes based on configuration.

```typescript
// Hypothetical — same API, better PDF output when Docling is available
const result = await convertDocument("/path/scanned.pdf", {
  outputDir: "/path/out",
  pdfBackend: "docling-serve",  // new option; default remains "pdfjs"
  doclingServeUrl: "http://localhost:5001"
});
```

**Effort:** Medium (2-3 weeks). Requires: HTTP client for Docling Serve API, response mapping to `ConversionResult`, configuration for the optional backend, tests with mocked Docling responses.

**Value:** High. Eliminates doc2md's biggest limitation (scanned/image-based PDFs) for users who can run Docling Serve. Browser mode stays untouched. The privacy story becomes: "Browser-only by default; optionally route PDFs through your own Docling server."

**Risk:** Adds an optional dependency and a second code path for PDF conversion. Must not regress the zero-server experience.

#### Possibility 2: Playwright E2E Tests with Tag-Based CI Gating
**What:** Add browser e2e tests for core user flows: drag-and-drop upload, format conversion, download, multi-file batch, error states.

**How:** Playwright (not Karate — stay in the JS ecosystem). Adopt DS's tag conventions:
- `@smoke`: quick conversion of one file per format → runs on every PR
- `@regression`: full matrix (all formats, edge cases, concurrent batches) → runs on release branches
- `@critical`: 3-5 core user journeys → runs on `main`

**Effort:** Medium (1-2 weeks for initial suite). Requires: Playwright setup, 5-10 feature tests, CI workflow updates, `data-testid` attributes on key UI elements.

**Value:** High. Closes the biggest testing gap. Catches UI regressions that unit tests miss.

**Risk:** Low. Additive — doesn't change existing code.

#### Possibility 3: Hexagonal Architecture for @doc2md/core
**What:** Refactor `@doc2md/core` to use a ports/adapters pattern, making the conversion backend swappable.

**How:** Define a `DocumentConverter` interface (TypeScript equivalent of DS's Protocol-based port). Current converters become the default adapter. The Docling Serve adapter (Possibility 1) becomes a second adapter. Dependency injection at package initialization.

```typescript
// Hypothetical port definition
interface DocumentConverter {
  convert(input: Buffer, format: SupportedFormat): Promise<ConversionResult>;
}

// Current converters become the "local" adapter
class LocalConverter implements DocumentConverter { ... }

// Docling Serve becomes the "remote" adapter
class DoclingServeConverter implements DocumentConverter { ... }
```

**Effort:** Medium-High (2-4 weeks). Requires: interface definitions, refactor of current converter dispatch, DI container or factory, tests for both adapters.

**Value:** Medium. Enables Possibility 1 cleanly and future converter backends (e.g., cloud-based OCR services). But may be over-architecture for the current scope.

**Risk:** Over-engineering risk if the second adapter never materializes. Only pursue if Possibility 1 is confirmed.

#### Possibility 4: Conversion History / Persistence (Lightweight)
**What:** Add optional browser-side persistence for conversion results using IndexedDB.

**How:** Users could revisit past conversions without re-uploading. Store the markdown output, warnings, and quality metadata. No server needed — stays in the browser.

**Effort:** Low-Medium (1 week). Requires: IndexedDB wrapper, history UI component, cleanup/purge logic.

**Value:** Medium. Addresses a common workflow friction (closing the tab loses output). Competitive feature parity with DS's history.

**Risk:** Low. Optional feature, doesn't change core conversion flow.

### 8.3 What NOT to Copy

**Don't add a backend just to have one.** Docling-Studio needs a server because ML inference requires it. doc2md's no-server model is a feature, not a limitation. Only add a backend (Possibility 1) if the ML-powered PDF quality actually solves a user problem.

**Don't adopt the full audit framework.** 12 audit templates with weighted scoring is proportional to Docling-Studio's complexity and enterprise audience. For doc2md, it would be governance theater. A simple release checklist and the PR verdict pattern are enough.

**Don't add i18n prematurely.** Docling-Studio's FR/EN support makes sense for a French company (scub-france). doc2md's audience is primarily English-speaking developers and agents. i18n adds maintenance cost for marginal value unless the user base demands it.

**Don't switch to Vue/Pinia.** Docling-Studio's frontend choices are fine but not better than React for doc2md's needs. The feature-based organization is worth noting, but React hooks + co-located components achieve the same modularity.

---

## Appendix: Key Files Referenced

### doc2md
| File | Purpose |
|------|---------|
| `src/converters/index.ts` | Converter registry and format dispatch |
| `src/converters/types.ts` | ConversionResult, Converter type definitions |
| `src/converters/pdf.ts` | PDF.js text extraction (1,431 lines) |
| `src/hooks/useFileConversion.ts` | React state management with concurrency control |
| `packages/core/src/index.ts` | @doc2md/core public API |
| `packages/core/src/batch.ts` | Batch processing with limits |
| `packages/core/src/cli.ts` | CLI entry point |
| `docs/product-spec.md` | Product vision and principles |
| `docs/architecture.md` | Browser-only architecture, trust model |
| `docs/testing.md` | Testing strategy |
| `docs/using-doc2md-core.md` | Node package API and CLI guide |
| `.github/workflows/ci.yml` | CI pipeline (lint, typecheck, test, build) |
| `.github/workflows/deploy-pages.yml` | GitHub Pages deployment |
| `eslint.config.js` | Linting configuration |
| `tsconfig.json` | TypeScript strict mode config |
| `test-fixtures/` | 22 test fixture files |

### Docling-Studio
| File | Purpose |
|------|---------|
| `document-parser/domain/ports.py` | Protocol-based port interfaces |
| `document-parser/domain/models.py` | Domain models with state machine |
| `document-parser/domain/value_objects.py` | ConversionResult, PageDetail |
| `document-parser/services/analysis_service.py` | Async orchestration (367 lines) |
| `document-parser/infra/local_converter.py` | Docling ML adapter (threaded) |
| `document-parser/infra/serve_converter.py` | Docling Serve HTTP adapter |
| `document-parser/api/analyses.py` | FastAPI analysis endpoints |
| `document-parser/api/schemas.py` | Pydantic DTOs |
| `document-parser/main.py` | FastAPI bootstrap, DI wiring |
| `document-parser/tests/test_models.py` | Domain state machine tests |
| `document-parser/tests/test_analysis_service.py` | Async service tests |
| `document-parser/pyproject.toml` | Ruff config, dependencies |
| `frontend/src/features/feature-flags/store.ts` | Feature flag store |
| `e2e/CONVENTIONS.md` | E2E test golden rules |
| `docs/architecture.md` | Architecture overview, feature flags, rate limiting |
| `docs/architecture/coding-standards.md` | Coding standards (30-line fn limit) |
| `docs/audit/master.md` | 12-audit framework with scoring |
| `docs/PROCESSES.md` | 19 documented processes |
| `docs/release/deployment-checklist.md` | Deployment + rollback checklist |
| `.github/workflows/ci.yml` | CI pipeline (4 jobs) |
| `.github/workflows/release-gate.yml` | 4-phase release gate |
| `.github/workflows/release.yml` | Multi-arch Docker image push |
| `CONTRIBUTING.md` | Branching strategy, release process |
| `SECURITY.md` | Vulnerability response SLAs |
| `docker-compose.yml` | Docker stack configuration |
| `Dockerfile` | Multi-target build (remote + local) |

---

## 9. Why Use doc2md When Docling-Studio Exists?

Three reasons:

**1. Different trust models — and trust matters.**
doc2md processes files entirely in your browser. Nothing uploads anywhere. You can convert a confidential contract, an NDA, or a medical record and know with certainty that no server ever saw it. Docling-Studio requires uploading your PDF to a server. Even self-hosted, that's a fundamentally different security posture. For privacy-conscious users, enterprises with data handling policies, or anyone working with sensitive documents — doc2md is the only option that requires zero trust decisions.

**2. doc2md isn't a PDF tool — it's a format tool.**
Docling-Studio handles PDFs. That's it. doc2md handles 10 formats: docx, xlsx, pdf, csv, tsv, pptx, html, txt, json, and md. If you have a mixed pile of documents to convert for an AI workflow, Docling-Studio can't help with 9 of those. doc2md handles all of them from one drop zone or one CLI command.

**3. Zero infrastructure, four consumption surfaces.**
- Open a browser tab, drag files, get markdown. Done in seconds.
- `npx doc2md resume.pdf notes.docx -o ./out` from a terminal.
- `import { convertDocuments } from "@doc2md/core"` in a Node script.
- Copy the `.skills/` folder into a repo and any coding agent can use it.

Docling-Studio requires Docker, port mapping, volume mounts, and in local mode a 1.9GB image plus a 400MB model download. That's fine for a team with infrastructure. It's a non-starter for someone who just wants markdown from a spreadsheet.

**When should someone use Docling-Studio instead?** When they have scanned PDFs, complex tables, or mathematical formulas — the ML-powered extraction is genuinely superior for those cases. doc2md is honest about this: it shows a "poor quality" warning on scanned PDFs rather than pretending.

The short version: Docling-Studio is a PDF analysis workbench. doc2md is a frictionless format converter. They're not competing — they're solving different problems for different moments.

---

## 10. Potential for Mutual Benefit: A Future Integration

These two projects are more complementary than competitive. The most natural integration point is `@doc2md/core` adding an optional Docling Serve backend for PDF processing.

**What this would look like:**

- doc2md's browser UI stays unchanged — zero-upload, instant conversion, 10 formats.
- `@doc2md/core` (the Node CLI/API) gains an optional `pdfBackend: "docling-serve"` configuration.
- When configured, PDF files are routed to a Docling Serve instance via HTTP for ML-powered extraction (OCR, tables, formulas). All other formats continue using the existing JavaScript converters.
- The API surface doesn't change. `convertDocuments()` and `convertDocument()` return the same `ConversionResult` type regardless of backend.

**Why this benefits both projects:**

- **doc2md gains:** ML-powered PDF quality for users who can run Docling Serve, without sacrificing the zero-server default. Scanned PDFs, complex tables, and formulas go from "poor quality warning" to structured extraction.
- **Docling/Docling Serve gains:** A new consumption surface. Users who discover doc2md for its multi-format conversion and agent skill portability can upgrade their PDF pipeline by pointing at a Docling Serve instance. doc2md becomes a lightweight frontend for Docling's capabilities.
- **The privacy story stays clean:** "Browser-only by default. Optionally route PDFs through your own Docling server." The user controls where files go — no SaaS, no third-party upload.

This is not a merge or a fork. It's a protocol-level integration where doc2md's `@doc2md/core` package speaks Docling Serve's HTTP API when configured. Two independent projects, one optional bridge.

**Prerequisite:** Possibility 3 (hexagonal architecture for `@doc2md/core`) makes this integration cleaner by defining a formal `DocumentConverter` port. But it's not strictly required — a simpler conditional dispatch in the PDF converter would also work.
