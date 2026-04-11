# PDF Multi-Line Cell Table Detection

## Summary

The PDF converter's table detection fails on tables where one or more cells contain multi-line text. These tables are common in healthcare, legal, and compliance documents, and represent a meaningful gap in conversion quality.

## Problem

The current `detectTableRegions()` in `src/converters/pdf.ts` works by:

1. Grouping text items by Y-coordinate into rows (`groupItemsByRow`)
2. For each row, computing column X-positions (`getRowColumnXs`)
3. Finding runs of >= 3 consecutive rows with matching column counts and positions
4. Rendering matched regions as markdown tables

This approach works well for simple grids where every cell is a single line. It breaks down when a table cell contains multiple lines of text, because each line becomes its own "row" with only one column. The algorithm sees 8 single-column rows instead of 1 two-column row with a tall left cell.

### Real-world example: Molina Healthcare "SUMMARY OF REVIEW/REVISIONS"

The PDF has a two-column table:

```
| SUMMARY OF REVIEW/REVISIONS              | DATE    |
| REVISION- Notable revisions:             | Q3 2025 |
| Required Medical Information             |         |
| Continuation of Therapy                  |         |
| Duration of Approval                     |         |
| Quantity                                 |         |
| Contraindications/Exclusions/...         |         |
| Other Special Considerations             |         |
```

What PDF.js returns for this region (from page 8):

```
y=298  x=68  "SUMMARY"  x=126 "OF"  x=143 "REVIEW/REVISIONS"  x=409 "DATE"    <- 2 columns detected
y=283  x=50  "REVISION- Notable revisions:"                      x=335 "Q3 2025" <- 2 columns detected
y=271  x=50  "Required Medical Information"                                       <- 1 column only
y=258  x=50  "Continuation of Therapy"                                            <- 1 column only
y=245  x=50  "Duration of Approval"                                               <- 1 column only
y=232  x=50  "Quantity"                                                           <- 1 column only
y=220  x=50  "Contraindications/Exclusions/Discontinuation"                       <- 1 column only
y=207  x=50  "Other Special Considerations"                                       <- 1 column only
```

Only 2 of 8 rows have items in both columns. The algorithm requires 3+ matching multi-column rows (TABLE_MIN_ROWS = 3), so the table is not detected. Instead, each line renders as a bullet point.

## Current Approach

Key constants and logic in `src/converters/pdf.ts`:

- `TABLE_COLUMN_TOLERANCE = 10` (pixels) for matching column positions
- `TABLE_HEADER_TOLERANCE = 20` for header row matching
- `TABLE_MIN_ROWS = 3` minimum consecutive matching rows
- `getRowColumnXs()` returns column positions only if row has >= 2 clusters
- `detectTableRegions()` scans for consecutive rows with identical column structure

The algorithm is designed for "spreadsheet-like" tables where every row has the same number of populated columns. It has no concept of empty cells, merged cells, or cells spanning multiple Y-positions.

## Validation Tests (Pre-Fix)

Before changing any detection logic, we need tests that capture the current limitation so we can measure improvement without regression.

### Test 1: Multi-line cell table is NOT detected (baseline)

Construct items mimicking the Molina "SUMMARY OF REVIEW/REVISIONS" table: a header row with 2 columns, one data row with 2 columns, then 6 rows with only the left column populated. Verify that `renderPdfPageText()` does NOT produce pipe-delimited markdown table output. This test documents the current limitation.

### Test 2: Simple uniform table IS detected (guard)

Existing tests already cover this, but add an explicit 2-column, 4-row table where every row has both columns populated. Verify it renders as a markdown table. This prevents regressions when improving multi-line detection.

### Test 3: Mixed populated/empty cells

A 3-column table where some cells are empty (no text item at that X-position in some rows). Currently this would also fail detection. Capturing the behavior gives us a baseline.

### Test 4: Real-world fixture test

If we add the Molina PDF as a test fixture (or a synthetic reproduction), test the full `convertPdf` pipeline and assert on the table region output. This is the integration-level validation.

## Improvement Approaches

### Approach A: Column-boundary detection (recommended)

Instead of bottom-up row matching, detect column boundaries first by looking at X-position clustering across a region:

1. Collect all text items in a Y-range (potential table region)
2. Build X-position histogram across all items
3. Identify consistent column start positions (X-positions that appear in many rows)
4. If 2+ distinct column positions are found, project items into a column grid
5. Assign each item to the nearest column based on X-position
6. Build table rows by grouping items with the same Y-coordinate
7. Empty cells are column positions with no item at that Y

**Advantages**: Handles sparse cells naturally. A column with 8 items and a column with 2 items both get detected because the column positions are established globally, not per-row.

**Risks**: False positives on two-column layouts that are not tables (e.g., a sidebar next to body text). Would need heuristics to distinguish: table headers, ruled lines, consistent vertical alignment over a bounded region.

### Approach B: Lookahead in current algorithm

Keep the current row-matching approach but add lookahead:

1. When a row has 2+ columns, remember those column positions
2. For subsequent single-column rows, check if their X-position aligns with one of the remembered columns
3. If it does, treat the row as having an empty second column
4. Continue accumulating until a row breaks the column pattern

**Advantages**: Minimal change to existing code. Easy to reason about.

**Risks**: Depends on the multi-column row appearing before the single-column continuation rows. If the "Q3 2025" row came after the list items, this approach would miss it.

### Approach C: Region-based table detection via visual cues

Use `page.getOperatorList()` to detect drawn lines/rectangles that form table borders. Many PDF tables have visible grid lines rendered as path operations (lineTo, rectangle, stroke). If we detect a rectangular grid, we can map text items into cells using the grid coordinates.

**Advantages**: Very accurate for tables with visible borders. The Molina table has teal-colored borders.

**Risks**: Higher complexity. Not all tables have visible borders (some use only whitespace). Requires parsing PDF drawing operators, which is a different skill from text extraction. Would be a supplementary signal, not a replacement.

### Approach D: Hybrid (A + current)

Run both the current uniform-row detection and the new column-boundary detection. Use the current algorithm as the primary (it works well for simple tables), and fall back to column-boundary detection for regions where:
- A multi-column header row is found but subsequent rows are single-column
- There is a large gap between items on the same row (suggesting columns)

**Advantages**: Zero regression risk for tables the current algorithm already handles. Incremental improvement.

**Risks**: Two code paths to maintain. Edge cases where both algorithms disagree.

## Recommendation

Start with **Approach B** (lookahead) as the lowest-risk incremental improvement, then validate with the pre-fix test suite. If it handles the common cases (like Molina), ship it. If gaps remain, layer **Approach A** (column-boundary detection) as a follow-up.

**Approach C** (visual cue detection) is worth exploring separately as a "table border detection" enhancement, but should not block text-based improvements.

## Related

- The image detection feature (shipped in this branch) now transparently flags when table images could not be converted. This is the "honesty" path; better table detection is the "capability" path. Both are valuable.
- `detectTableRegions()` is at line ~870 in `src/converters/pdf.ts`
- `getRowColumnXs()` is at line ~730
- `TABLE_MIN_ROWS`, `TABLE_COLUMN_TOLERANCE`, `TABLE_HEADER_TOLERANCE` are constants at the top of the file
