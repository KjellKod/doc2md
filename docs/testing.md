# Testing Strategy

Testing should be practical and confidence-building, not performative.

## Current coverage

57 tests across 12 test files. Run with:

```bash
npm test -- --run
```

## Unit tests

* File type detection and per-format routing logic
* Markdown table generation (CSV, TSV, XLSX)
* JSON pretty-print conversion
* HTML-to-Markdown cleanup rules
* PDF warning detection heuristics
* Error-state handling

## Integration tests

* Single-file and mixed-format multi-file conversion flows
* Successful conversion, warning, and error paths
* Format router dispatching

## Smoke tests (`src/__tests__/smoke.test.ts`)

13 scenarios covering:

1. Each of the 9 supported formats converts correctly
2. Mixed-format batch conversion works independently
3. Unsupported format returns clear error
4. Empty file returns appropriate message

## Test fixtures

Located in `test-fixtures/`:

| Fixture | Format | Notes |
|---------|--------|-------|
| `sample.txt` | .txt | Simple text with mixed line endings |
| `sample.json` | .json | Small JSON object |
| `sample.csv` | .csv | 3 columns, 5 rows, quoted field with comma |
| `sample.tsv` | .tsv | 3 columns, 5 rows |
| `sample.html` | .html | Headings, paragraphs, list, table |
| `sample.docx` | .docx | Headings, paragraphs, list, table |
| `sample.xlsx` | .xlsx | Multi-sheet workbook |
| `sample.pdf` | .pdf | Text-based, selectable text |
| `sample-scanned.pdf` | .pdf | Image-based (tests quality warning) |
| `sample.pptx` | .pptx | Slides with titles and bullets |
| `sample-empty.txt` | .txt | Empty file |
| `sample-malformed.json` | .json | Invalid JSON |

## Manual review checklist

Before considering the project production-worthy:

* UI looks polished and calm
* Typography hierarchy feels intentional
* Empty state is strong
* Drag/drop behavior feels reliable
* Warnings are visible but not noisy
* Preview is readable
* Download naming is sensible (`source.ext` → `source.md`)
* Mixed-format handling feels obvious
* Nothing suggests files are uploaded or stored
