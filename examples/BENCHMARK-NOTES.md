# PDF Pipeline Benchmark Notes

## Run 1: Summary-only prompt (2026-04-04)

PDF: `Repo_Quality_Cleanup__Refactoring_and_Test_Quality_Spec.pdf` (137KB, 7 pages, clean layout)

| Case | Time | Status | Notes |
|------|------|--------|-------|
| Claude raw PDF | 31s | PASS | Native PDF reader, clean concise output |
| Claude + doc2md | 33s | PASS | Agent ran doc2md (94ms), then summarized markdown |
| Codex raw PDF | 50s | PASS | No native PDF reader; tried pdftotext, Python libs, mdls before extracting |
| Codex + doc2md | 23s | PASS | doc2md conversion fast, then clean summarization |

**Observation:** Claude has a built-in PDF reader and handles PDFs natively.
doc2md adds ~2s overhead for Claude (no benefit). For Codex, doc2md cuts time
by more than half (50s to 23s) because Codex has no native PDF extraction.

## Run 2: Summary + comprehension question (2026-04-04)

Same PDF, added question requiring specific detail from the Risks section (page 6).

| Case | Time | Status | Correct answer? |
|------|------|--------|----------------|
| Claude raw PDF | 26s | PASS | Yes |
| Claude + doc2md | 30s | PASS | Yes |
| Codex raw PDF | 52s | PASS | Yes |
| Codex + doc2md | 95s | PASS | Yes (but duplicated output, slower than expected) |

**Observation:** All four got the correct answer (Impact: High, Likelihood: Medium).
Claude raw was fastest at 26s. Codex + doc2md regressed to 95s with the harder
question, possibly due to extra reasoning passes around the conversion step.

## Key Takeaways (PDF only)

- For clean PDFs, Claude's native reader makes doc2md unnecessary overhead
- For models without native PDF reading (Codex), doc2md is a clear win
- doc2md's real value for PDF is in programmatic pipelines, batch processing, and
  producing inspectable/versionable markdown artifacts
- The stronger case for doc2md is non-PDF office formats (docx, xlsx, pptx) where
  no model has a native reader

## Run 3: Multi-format per-file (2026-04-04)

4 file types, each tested independently (16 sessions total). Summary-only prompt.

| Format | Claude raw | Claude+doc2md | Codex raw | Codex+doc2md |
|--------|-----------|---------------|-----------|-------------|
| PDF    | 27s       | 29s           | 54s       | 101s        |
| DOCX   | 25s       | 31s           | 26s       | 51s         |
| XLSX   | 29s       | 27s           | 56s       | 74s         |
| PPTX   | 33s       | 26s           | 25s       | (pending)   |

**Surprising findings:**

1. **Claude reads DOCX, XLSX, and PPTX natively.** It handled all four formats
   without doc2md, and was consistently fast (25-33s). The hypothesis that
   "non-PDF formats need doc2md" was wrong for Claude.

2. **Codex also reads DOCX and PPTX natively** (26s and 25s), but is slower on
   XLSX (56s) and PDF (54s). Codex may have built-in support for some Office
   formats but not others.

3. **doc2md adds overhead in most per-file cases.** For Claude, it's negligible
   (1-6s). For Codex, the doc2md path is consistently slower, sometimes 2x.

4. **The per-file benchmark may disadvantage doc2md** because each session pays
   the full agent startup + tool invocation cost for running doc2md on a single
   file. Batch mode (all files at once, one doc2md invocation) should be fairer.

## Revised Takeaways

- Both Claude and Codex have broader native file reading than expected
- For single-file workflows, doc2md adds overhead without clear speed benefit
- doc2md's value proposition shifts to:
  - Batch/pipeline processing (convert once, query many times)
  - Deterministic, inspectable markdown output
  - Consistency across models and environments
  - Environments without native file readers (API-only, sandboxed)
- Batch mode benchmark (next) will test whether doc2md shines when processing
  multiple files in a single conversion pass

## Run 4: Batch mode, 4 file types (2026-04-04)

All 4 files in one sandbox per agent. Agent processes everything in a single session.

| Case | Time | Response | Notes |
|------|------|----------|-------|
| Claude raw | 56s | 3.1KB | Read all 4 formats natively, excellent summaries |
| Claude+doc2md | 51s | 3.4KB | 5s faster than raw (first doc2md win for Claude) |
| Codex raw | 133s | 38KB | Handled all formats but verbose, slow |
| Codex+doc2md | 227s | 67KB | Slowest; doc2md invocation overhead dominated |

**Observations:**

1. **Claude+doc2md beat Claude raw by 5s in batch mode.** This is the first time
   doc2md helped Claude. With 4 files to process, pre-converting to markdown
   likely reduced repeated file-reading tool calls.

2. **Codex+doc2md was the slowest overall (227s).** The Codex agent spent
   significant time invoking doc2md, reading output, and produced 67KB of verbose
   output. The conversion overhead outweighed any reading benefit.

3. **Claude's response quality was notably better.** 3.1KB of clean, structured
   summaries vs 38KB of verbose Codex output with tool call noise.

4. **Both models read all 4 formats natively in batch mode.** No failures on any
   format, even without doc2md.

## Overall Conclusions (after 4 runs)

**When doc2md helps:**
- Batch processing with Claude (small but real speedup)
- Programmatic pipelines where you convert once and query multiple times
- Environments without native file readers (API-only, restricted sandboxes)
- Producing deterministic, inspectable, versionable markdown artifacts

**When doc2md does not help (or hurts):**
- Single-file workflows with Claude (native reader is fast enough)
- Codex workflows in general (agent overhead of running doc2md outweighs benefit)
- Simple summarization tasks on clean, well-structured documents

**The honest take:** Modern AI models (especially Claude) have surprisingly good
native file reading across PDF, DOCX, XLSX, and PPTX. doc2md's speed advantage
is marginal for interactive use. Its real value is in automation pipelines,
consistency across models, and producing reviewable intermediate artifacts.
