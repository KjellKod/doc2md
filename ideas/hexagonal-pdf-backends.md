# Hexagonal Architecture for @doc2md/core

**Status:** Idea — not planned until a second PDF backend is confirmed
**Context:** Inspired by [Docling-Studio's architecture](https://github.com/KjellKod/doc2md/blob/main/docs/comparisons/docling-studio.md)

## The Problem

Today, `@doc2md/core` has one PDF conversion path: PDF.js text extraction. It works well for text-based PDFs but can't handle scanned documents, complex tables, or embedded formulas. When those use cases arrive, we'll need alternative backends — and the current code has the PDF.js implementation wired directly into the converter.

```
Current: tightly coupled
┌──────────────────────────────────┐
│  convertPdf()                    │
│    → PDF.js text extraction      │  ← only option
│    → quality heuristics          │
│    → ConversionResult            │
└──────────────────────────────────┘
```

Adding a second backend means either `if/else` spaghetti inside `convertPdf()` or a clean abstraction.

## What Is Hexagonal Architecture?

The core business logic talks to the outside world through **ports** (contracts) and **adapters** (implementations). The core defines *what* it needs. Adapters define *how*.

```
                         ┌─────────────────────────┐
                         │                         │
    ┌─────────────┐      │      Core Logic         │      ┌──────────────┐
    │  PDF.js     │─────▶│                         │◀─────│  CLI         │
    │  (adapter)  │      │  "Convert this file     │      │  (adapter)   │
    └─────────────┘      │   and return markdown"  │      └──────────────┘
                         │                         │
    ┌─────────────┐      │  Defines the PORT:      │      ┌──────────────┐
    │  Docling    │─────▶│  PdfConverter interface  │◀─────│  API         │
    │  Serve      │      │                         │      │  (adapter)   │
    │  (adapter)  │      │  Doesn't know which     │      └──────────────┘
    └─────────────┘      │  adapter is plugged in   │
                         │                         │
    ┌─────────────┐      │                         │
    │  LLM / OCR  │─────▶│                         │
    │  (adapter)  │      │                         │
    └─────────────┘      └─────────────────────────┘

    ◀── Inbound adapters         Outbound adapters ──▶
        (how files arrive)       (how conversion happens)
```

The key insight: **the core never imports an adapter**. Adapters import the core's interface and satisfy it. You swap backends by swapping adapters at startup, not by changing business logic.

## The Smart Path: Fast First, Fallback on Quality

The most interesting adapter isn't a single backend — it's a **cascading adapter** that tries the fast path first and auto-escalates when quality signals indicate trouble.

doc2md already produces quality signals: `"good" | "review" | "poor"`, image detection, watermark detection, table heuristics. Today those signals become warnings for the user. With a fallback adapter, they become *triggers for automatic re-conversion*.

```
┌──────────────────────────────────────────────────────────────┐
│  CascadingPdfConverter                                       │
│                                                              │
│  Step 1: PDF.js (fast path)                                  │
│    ├── quality: "good"  → return result ✓  (milliseconds)    │
│    ├── quality: "review" + tables detected → escalate ⚠️     │
│    ├── quality: "poor"  → escalate ⚠️                        │
│    └── images detected, low text ratio → escalate ⚠️         │
│                                                              │
│  Step 2: Fallback adapter (only if escalated)                │
│    ├── Docling Serve  → ML extraction (minutes)              │
│    ├── LLM Vision     → per-page OCR (seconds/page)         │
│    └── return fallback result ✓                              │
│                                                              │
│  Result includes:                                            │
│    - which adapter produced the final output                 │
│    - why escalation happened (or didn't)                     │
│    - time spent on each step                                 │
└──────────────────────────────────────────────────────────────┘
```

**Why this is better than user-picks-backend:**
- The user doesn't need to know or care which backend runs
- Text PDFs stay instant — no penalty for the common case
- Scanned PDFs, image-heavy PDFs, and complex tables automatically get better treatment
- The quality heuristics we already built become the routing logic, not just warnings

```typescript
// adapters/cascading-converter.ts

import type { PdfConverter, PdfConvertResult } from "../ports/pdf-converter.js";

export interface CascadingConfig {
  /** Primary (fast) converter — always tried first */
  primary: PdfConverter;
  /** Fallback converter — used when primary quality is insufficient */
  fallback: PdfConverter;
  /** Quality threshold below which we escalate. Default: "review" */
  escalateAt?: "review" | "poor";
}

export class CascadingPdfConverter implements PdfConverter {
  private primary: PdfConverter;
  private fallback: PdfConverter;
  private escalateAt: "review" | "poor";

  constructor(config: CascadingConfig) {
    this.primary = config.primary;
    this.fallback = config.fallback;
    this.escalateAt = config.escalateAt ?? "review";
  }

  async convert(input: Buffer, options?: PdfConvertOptions): Promise<PdfConvertResult> {
    // Step 1: fast path
    const primaryResult = await this.primary.convert(input, options);

    // Good quality? Done.
    if (!this.shouldEscalate(primaryResult)) {
      return { ...primaryResult, adapter: "primary" };
    }

    // Step 2: escalate to fallback
    try {
      const fallbackResult = await this.fallback.convert(input, options);
      return {
        ...fallbackResult,
        adapter: "fallback",
        escalationReason: primaryResult.quality?.summary ?? "quality below threshold",
      };
    } catch (err) {
      // Fallback failed — return the primary result with a warning
      return {
        ...primaryResult,
        adapter: "primary",
        warnings: [
          ...primaryResult.warnings,
          `Fallback adapter failed: ${err.message}. Returning fast-path result.`,
        ],
      };
    }
  }

  private shouldEscalate(result: PdfConvertResult): boolean {
    if (!result.quality) return false;

    const dominated = this.escalateAt === "review"
      ? result.quality.level === "review" || result.quality.level === "poor"
      : result.quality.level === "poor";

    return dominated;
  }
}
```

**Wiring example:**

```typescript
const converter = new CascadingPdfConverter({
  primary: new PdfJsConverter(),
  fallback: new DoclingServeConverter({ baseUrl: "http://localhost:5001" }),
  escalateAt: "review",  // escalate on "review" or "poor"
});

// User code doesn't change
const result = await converter.convert(pdfBuffer);
// result.adapter tells you which path was taken
```

**CLI behavior:**

```bash
# No fallback configured — same as today
doc2md report.pdf -o ./out

# With auto-escalation — user doesn't pick, quality decides
doc2md report.pdf -o ./out \
  --pdf-fallback docling-serve \
  --docling-url http://localhost:5001

# Force a specific backend (skip fast path)
doc2md scanned.pdf -o ./out \
  --pdf-backend docling-serve \
  --docling-url http://localhost:5001
```

**User sees:**
```
✓ report.pdf → report.md (success, PDF.js, 0.3s)
⚠ scanned.pdf → scanned.md (success, escalated to Docling Serve — "poor: image-based PDF, no selectable text", 47s)
✓ notes.pdf → notes.md (success, PDF.js, 0.2s)
```

## The Port: PdfConverter Interface

One interface. Every PDF backend implements it — including the cascading adapter.

```typescript
// ports/pdf-converter.ts

export interface PdfConvertOptions {
  /** Page range to convert (1-indexed, inclusive). Omit for all pages. */
  pageRange?: { start: number; end: number };
}

export interface PdfConvertResult {
  markdown: string;
  warnings: string[];
  status: "success" | "warning" | "error";
  quality?: {
    level: "good" | "review" | "poor";
    summary: string;
  };
  /** Number of pages processed */
  pageCount: number;
  /** Which adapter produced this result (for cascading) */
  adapter?: string;
  /** Why escalation happened, if it did */
  escalationReason?: string;
}

export interface PdfConverter {
  convert(input: Buffer, options?: PdfConvertOptions): Promise<PdfConvertResult>;
}
```

## Adapter 1: PDF.js (What We Have Today)

Local text extraction. Fast, private, limited to selectable text.

```typescript
// adapters/pdfjs-converter.ts

import type { PdfConverter, PdfConvertResult } from "../ports/pdf-converter.js";

export class PdfJsConverter implements PdfConverter {
  async convert(input: Buffer): Promise<PdfConvertResult> {
    // Existing PDF.js logic extracted from src/converters/pdf.ts
    // Text extraction, quality heuristics, warning generation
    // Returns ConversionResult mapped to PdfConvertResult
  }
}
```

**Characteristics:**
- Zero network calls — runs in-process
- Fast — often fractions of a second per document
- Privacy-first — file never leaves the machine
- Limited — no OCR, no table structure, no formula recognition
- Produces quality signals that drive the cascading adapter

## Adapter 2: Docling Serve (Remote ML)

HTTP client that delegates to a [Docling Serve](https://github.com/DS4SD/docling-serve) instance for ML-powered extraction.

```typescript
// adapters/docling-serve-converter.ts

import type { PdfConverter, PdfConvertResult, PdfConvertOptions } from "../ports/pdf-converter.js";

export interface DoclingServeConfig {
  baseUrl: string;
  apiKey?: string;
  timeoutMs?: number;  // default: 600_000 (10 min — ML is slow)
}

export class DoclingServeConverter implements PdfConverter {
  private config: DoclingServeConfig;

  constructor(config: DoclingServeConfig) {
    this.config = config;
  }

  async convert(input: Buffer, options?: PdfConvertOptions): Promise<PdfConvertResult> {
    // POST multipart/form-data to Docling Serve
    // Map Docling response (markdown, html, document_json) to PdfConvertResult
    // Handle timeouts, errors, retries
  }
}
```

**Characteristics:**
- Requires a running Docling Serve instance (Docker)
- Slow — minutes per document (OCR + table detection + formula recognition)
- Powerful — handles scanned PDFs, complex tables, embedded formulas
- Privacy trade-off — file sent to the Docling server (self-hosted)

## Adapter 3: LLM Vision / OCR (Future)

Use an LLM with vision capabilities (Claude, GPT-4o) or a dedicated OCR service to extract content from PDFs page-by-page.

```typescript
// adapters/llm-ocr-converter.ts

import type { PdfConverter, PdfConvertResult } from "../ports/pdf-converter.js";

export interface LlmOcrConfig {
  provider: "anthropic" | "openai" | "google";
  model: string;           // e.g. "claude-sonnet-4-5-20241022", "gpt-4o"
  apiKey: string;
  maxConcurrentPages?: number;  // default: 5
  timeoutMs?: number;
}

export class LlmOcrConverter implements PdfConverter {
  private config: LlmOcrConfig;

  constructor(config: LlmOcrConfig) {
    this.config = config;
  }

  async convert(input: Buffer, options?: PdfConvertOptions): Promise<PdfConvertResult> {
    // 1. Render PDF pages to images (pdf-to-img or similar)
    // 2. Send each page image to the LLM vision API
    // 3. Prompt: "Extract all text, tables, and structure as markdown"
    // 4. Concatenate page results
    // 5. Map to PdfConvertResult
  }
}
```

**Characteristics:**
- Requires API key and network access
- Cost per page — LLM API pricing applies
- Quality varies by model and prompt engineering
- Handles scanned PDFs, handwriting, complex layouts
- Latency: seconds per page (parallel), minutes per document
- Privacy consideration — pages sent to external API

## Wiring: Adapter Selection at Startup

The factory supports both explicit backend selection and the cascading pattern.

```typescript
// factory/create-pdf-converter.ts

import type { PdfConverter } from "../ports/pdf-converter.js";
import { PdfJsConverter } from "../adapters/pdfjs-converter.js";

export interface PdfBackendConfig {
  /** Explicit backend — skips fast path, uses this directly */
  backend?: "pdfjs" | "docling-serve" | "llm-ocr";
  /** Fallback — uses PDF.js first, escalates on quality signals */
  fallback?: "docling-serve" | "llm-ocr";
  /** When to escalate. Default: "review" */
  escalateAt?: "review" | "poor";
  doclingServe?: {
    baseUrl: string;
    apiKey?: string;
  };
  llmOcr?: {
    provider: "anthropic" | "openai" | "google";
    model: string;
    apiKey: string;
  };
}

export async function createPdfConverter(config?: PdfBackendConfig): Promise<PdfConverter> {
  // Explicit backend — direct, no cascading
  if (config?.backend && config.backend !== "pdfjs") {
    return createDirectAdapter(config);
  }

  // Fallback configured — cascading pattern
  if (config?.fallback) {
    const { CascadingPdfConverter } = await import("../adapters/cascading-converter.js");
    return new CascadingPdfConverter({
      primary: new PdfJsConverter(),
      fallback: await createDirectAdapter({
        backend: config.fallback,
        ...config,
      }),
      escalateAt: config.escalateAt ?? "review",
    });
  }

  // Default — PDF.js only
  return new PdfJsConverter();
}
```

## How It Looks to the User

```typescript
// Default — same as today, PDF.js only
const result = await convertDocument("/path/report.pdf", {
  outputDir: "./out",
});

// Auto-escalation — fast path first, Docling Serve if quality is poor
const result = await convertDocument("/path/scanned-report.pdf", {
  outputDir: "./out",
  pdfFallback: {
    fallback: "docling-serve",
    doclingServe: { baseUrl: "http://localhost:5001" },
  },
});

// Force a specific backend — skip fast path entirely
const result = await convertDocument("/path/scanned-report.pdf", {
  outputDir: "./out",
  pdfBackend: {
    backend: "llm-ocr",
    llmOcr: {
      provider: "anthropic",
      model: "claude-sonnet-4-5-20241022",
      apiKey: process.env.ANTHROPIC_API_KEY,
    },
  },
});
```

CLI equivalent:

```bash
# Default (PDF.js only)
doc2md report.pdf -o ./out

# Auto-escalation (fast path + fallback)
doc2md scanned-report.pdf -o ./out \
  --pdf-fallback docling-serve \
  --docling-url http://localhost:5001

# Force backend (skip fast path)
doc2md scanned-report.pdf -o ./out \
  --pdf-backend llm-ocr \
  --llm-provider anthropic \
  --llm-model claude-sonnet-4-5-20241022
```

## Comparison of Backends

| Aspect | PDF.js | Docling Serve | LLM / OCR |
|--------|--------|---------------|-----------|
| **Speed** | Milliseconds–seconds | Minutes | Seconds/page |
| **Scanned PDFs** | Quality warning | Full OCR | Full OCR |
| **Tables** | Text extraction only | Structure detection | Depends on model |
| **Formulas** | No | Recognition | Depends on model |
| **Privacy** | Local only | Self-hosted server | External API |
| **Cost** | Free | Infrastructure | Per-page API cost |
| **Infrastructure** | None | Docker + Docling | API key |
| **Best for** | Text PDFs, quick conversion | Scanned archives, complex structures | Mixed content, handwriting |

## Escalation Signals (Already Built)

These quality signals already exist in `src/converters/pdf.ts`. Today they produce warnings. Tomorrow they drive adapter selection.

| Signal | Current behavior | Cascading behavior |
|--------|-----------------|-------------------|
| `quality: "poor"` | Warning to user | Escalate to fallback |
| `quality: "review"` | Warning to user | Escalate (configurable) |
| Images detected, low text ratio | Warning to user | Escalate to fallback |
| Watermark detected | Strip + warn | No escalation (handled locally) |
| Complex tables detected | Best-effort extraction | Escalate to fallback |

## When to Build This

**Not now.**

We have one PDF backend. Adding an interface around a single implementation is YAGNI — it's an abstraction with no second data point to inform the contract.

**Build it when:**
- A concrete second backend is confirmed (Docling Serve integration or LLM/OCR)
- At that point, the refactor is small: extract the interface from the existing PDF.js converter, write the new adapter, add the cascading wrapper, add the factory
- Two real implementations tell you what the interface *actually needs* — one implementation only tells you what you *guess* it needs

**The cascading pattern is the key insight.** It means the common case (text PDFs) stays instant, and the user never needs to know which backend handled their file. Quality signals we already produce become the routing logic. The abstraction pays for itself only when there's a real fallback to cascade to.

As the `AGENTS.md` says: YAGNI — You Aren't Gonna Need It. Until you do.
