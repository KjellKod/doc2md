# Idea: Replace `xlsx` with `read-excel-file`

## Status
Proposed

## Problem
The `xlsx` (SheetJS) package has two unpatched high-severity CVEs:
- **Prototype Pollution** — GHSA-4r6h-8v6p-xvw6
- **ReDoS** — GHSA-5pgg-2g8v-p4x9

No fix is available. The npm package is effectively abandoned.

## Risk Assessment (Current)
doc2md is **client-side only**. Users upload their own local files. The practical risk is very low:
- Prototype pollution could corrupt page state, but an attacker would need to trick a user into uploading a crafted `.xlsx` — the payoff is messing up that user's own tab.
- ReDoS freezes the user's own browser tab. They close it. Done.

**Decision:** Accept the risk for now. This is an informed acceptance, not negligence.

## Proposed Replacement
[`read-excel-file`](https://www.npmjs.com/package/read-excel-file) — MIT, actively maintained, read-only, lightweight.

## Surface Area
The xlsx dependency is contained to two files:
- `src/converters/office.ts` — `readWorkbook()`, `sheetToRows()`
- `src/converters/xlsx.test.ts` — test fixtures use `XLSX.utils` for workbook creation

## Migration Steps
1. `npm install read-excel-file && npm uninstall xlsx`
2. Rewrite `office.ts`: replace `readWorkbook` and `sheetToRows` with `read-excel-file` API
3. Update `xlsx.test.ts` — fixture-based test stays, mock-based tests need new setup
4. Verify the sample.xlsx fixture still produces identical markdown output
5. Run full test suite, confirm no regressions

## Notes
- `read-excel-file` is read-only, which is exactly what doc2md needs — we never write spreadsheets.
- The API returns rows as arrays, which maps directly to our existing `sheetToRows` → markdown table pipeline.
- Consider whether multi-sheet support needs any special handling (it does support it via `getSheetNames`).
