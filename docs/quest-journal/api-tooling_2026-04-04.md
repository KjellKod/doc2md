# Quest Journal: API Tooling

- Quest ID: `api-tooling_2026-04-04__0801`
- Date: `2026-04-04`
- Mode: `workflow`
- Outcome: complete after 5 plan iterations and 2 fix iterations

## Summary
Built `@doc2md/core` as an easy-to-install workspace package for batch and single-document conversion from disk inputs into markdown files plus structured JSON results. The final implementation keeps the existing browser app intact, adds explicit Node runtime plumbing for the shared converters, verifies PDF quality parity against a browser-generated golden artifact, and hardens the package contract around batch limits, unsupported inputs, per-document failures, clean-consumer installability, and concurrent duplicate-basename writes.

## Files Changed
- `package.json`
- `package-lock.json`
- `vite.config.ts`
- `src/converters/pdf.ts`
- `src/converters/pptx.ts`
- `src/converters/readBinary.ts`
- `src/converters/readText.ts`
- `src/converters/richText.ts`
- `src/converters/runtime.ts`
- `src/__tests__/pdfBrowserGolden.test.ts`
- `test-fixtures/sample.pdf.browser-golden.json`
- `packages/core/package.json`
- `packages/core/bin/doc2md.js`
- `packages/core/vite.config.ts`
- `packages/core/vitest.config.ts`
- `packages/core/tsconfig.json`
- `packages/core/src/types.ts`
- `packages/core/src/node-compat.ts`
- `packages/core/src/io.ts`
- `packages/core/src/batch.ts`
- `packages/core/src/index.ts`
- `packages/core/src/cli-options.ts`
- `packages/core/src/cli.ts`
- `packages/core/src/test-helpers.ts`
- `packages/core/src/io.test.ts`
- `packages/core/src/convertDocument.test.ts`
- `packages/core/src/batch.test.ts`
- `packages/core/src/convert.test.ts`
- `packages/core/src/cli-options.test.ts`
- `packages/core/src/install-smoke.test.ts`

## Iterations
- Plan iterations: `5`
- Fix iterations: `2`
- Review outcome: both final review slots returned `next: null`

## Validation
- `npm run test --workspace=@doc2md/core`
- `npm run build --workspace=@doc2md/core`
- `npx vitest run`
- `npm run build`

## Notes
- The plan took several iterations because the scope pivoted from feasibility analysis into a real build quest and the review gate forced the contracts to become explicit before code landed.
- Reviewer A and reviewer B both caught real issues in the implementation: a concurrent output-path race, batch-aborting per-document I/O failures, and CLI numeric parsing that could silently break the batch contract.
- The final package behavior is intentionally file-based by default: markdown is written to disk, JSON stays metadata-only, unsupported inputs are skipped, and supported-but-bad inputs return `status: "error"` rows instead of crashing the batch.
- Remaining risk is mostly operational: downstream consumers still need to decide how they want to package and expose the emitted markdown files, but the core extraction boundary is now stable.

## Celebration Data

<!-- celebration-data-start -->
```json
{
  "quest_mode": "workflow",
  "agents": [
    {"name": "Planner", "model": "Claude Opus 4.6", "role": "Plan creation"},
    {"name": "Plan Reviewer A", "model": "Claude Opus 4.6", "role": "Plan review"},
    {"name": "Plan Reviewer B", "model": "gpt-5.4", "role": "Plan review"},
    {"name": "Arbiter", "model": "Claude Opus 4.6", "role": "Plan arbitration"},
    {"name": "Builder", "model": "gpt-5.4", "role": "Implementation"},
    {"name": "Code Reviewer A", "model": "Claude Opus 4.6", "role": "Code review"},
    {"name": "Code Reviewer B", "model": "gpt-5.4", "role": "Code review"},
    {"name": "Fixer", "model": "gpt-5.4", "role": "Fix loop"}
  ],
  "achievements": [
    {"icon": "📦", "title": "Portable Core Package", "desc": "Added `@doc2md/core` with batch and single-document APIs plus a CLI."},
    {"icon": "🧪", "title": "Real Consumer Coverage", "desc": "Verified tarball install, API import, CLI execution, and no React runtime leakage."},
    {"icon": "🛡️", "title": "Contract Hardening", "desc": "Closed batch-limit, collision, per-document failure, and CLI parsing edge cases through the fix loop."}
  ],
  "metrics": [
    {"icon": "📊", "label": "213 tests passing"},
    {"icon": "🔁", "label": "2 fix iterations"},
    {"icon": "🗂️", "label": "30 implementation files changed"}
  ],
  "quality": {"tier": "Gold", "icon": "🥇", "grade": "A-"},
  "quote": {"text": "Fix pass 2 approved: all must-fix items resolved, acceptance criteria fully covered, no blocking issues.", "attribution": "Code Reviewer A"},
  "victory_narrative": "The browser-only converters stopped being trapped in the browser. A reusable Node package emerged around them, and every contract the review found soft or dishonest got tightened until the batch API behaved like something another system could actually trust.",
  "test_count": 213,
  "tests_added": 22,
  "files_changed": 30
}
```
<!-- celebration-data-end -->
