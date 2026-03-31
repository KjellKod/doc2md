# Quest Journal: PDF Quality Signals

**Quest ID:** `pdf-quality-signals_2026-03-30__2053`
**Date:** 2026-03-30
**Mode:** workflow (full dual-review)
**Outcome:** Complete

## Summary

Added a PDF-only quality signal so converted PDFs no longer read as a binary success-or-failure event. The change stayed inside the boundary the user asked for: no parser-engine rewrite, no OCR, no server work, and no generalized scoring system for other formats.

The feature now does four things together:

1. Extends PDF conversion results with structured `quality` metadata using coarse `good`, `review`, and `poor` levels.
2. Persists that metadata on `FileEntry` so the UI can render it directly instead of reverse-engineering warning strings.
3. Shows a small preview-only quality indicator with exact tooltip copy, keyboard support, and tap/click behavior.
4. Covers the heuristics with explicit boundary-condition tests so the signal cannot drift quietly.

## Files Changed

| File | Change |
|------|--------|
| `src/converters/types.ts` | Added PDF quality types and optional `quality` on `ConversionResult` |
| `src/types/index.ts` | Added optional `quality` to `FileEntry` |
| `src/converters/pdf.ts` | Extended PDF heuristics, added structured quality output, preserved warnings, and covered corrupt/error paths |
| `src/hooks/useFileConversion.helpers.ts` | Persisted `quality` on success and cleared stale `quality` on converting/error transitions |
| `src/components/PdfQualityIndicator.tsx` | Added focused PDF quality indicator component with tooltip behavior |
| `src/components/PreviewPanel.tsx` | Rendered the indicator in normal preview and PDF error paths only |
| `src/styles/global.css` | Added scoped `pdf-quality-*` styles for indicator and tooltip |
| `src/converters/pdf.test.ts` | Added level coverage plus explicit threshold-boundary tests |
| `src/hooks/useFileConversion.helpers.test.ts` | Added quality passthrough and stale-quality reset coverage |
| `src/components/PdfQualityIndicator.test.tsx` | Added component tests for labels, tooltip copy, keyboard focus, and click/tap |
| `src/components/PreviewPanel.test.tsx` | Added preview integration tests for PDF-only rendering and poor error-path visibility |

## Iterations

- Plan iterations: 1
- Fix iterations: 3
- Code review rounds: 4

## Review Notes

- The plan approved on the first iteration with three builder instructions: cover the PDF error path, verify touch behavior, and lock down tooltip copy.
- Code review found three real gaps over time:
  - heuristic boundary tests were initially missing
  - `quality` was not cleared on converting/error transitions
  - the corrupt-PDF catch path and tooltip-copy contract needed to match the approved spec exactly
- The final dual-review pass closed cleanly with both reviewers returning `next: null`.
- All Claude bridge handoffs in `context_health.log` were written through `handoff.json`.

## Validation

- `npx vitest run src/converters/pdf.test.ts src/hooks/useFileConversion.helpers.test.ts src/components/PdfQualityIndicator.test.tsx src/components/PreviewPanel.test.tsx` → 59 tests passing
- `npm test -- --run` → 27 files, 191 tests passing
- `npm run lint` → passed
- `npm run typecheck` → passed
- `npm run build` → passed
- `bash scripts/validate-manifest.sh` → passed during final review

## This Is Where It All Began

> `doc2md` already supports PDF conversion and already has warning plumbing, but the current experience is too binary and too subtle:
>
> - warnings only cover broad low-text and low-quality cases
> - warning visibility is easy to miss
> - users do not get a quick trust signal before they start reading the output

That idea survived contact with the codebase mostly intact. The implementation changed the mechanics, not the intent.
