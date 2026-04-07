# PDF Formatting Preservation Analysis

Date: 2026-04-06
Source: Manual comparison of `infliximab-remicade-inflectra.pdf` (29 pages, UHC drug policy) vs its doc2md markdown output.

## Context

The PDF is a structured medical policy document with: a title containing superscript `®` symbols, nested criteria lists with 4 indentation levels, two-column code/description tables spanning 12+ pages, repeating headers/footers on every page, bold inline formatting mixed with regular text, and a table of contents with dot leaders.

The converter uses pdfjs-dist for text extraction. All positional data (x, y, width, fontSize, fontName) is available per TextItem. The current converter uses fontSize and fontName but does not use x-position for layout detection.

## Issue 1: Superscript Symbol Fragmentation (Critical)

**Symptom:** Title `Infliximab (Avsola®, Inflectra®, Remicade®, & Renflexis®)` splits into 9 separate heading lines because each `®` uses a smaller font size (13pt vs 20.2pt body).

```markdown
# Infliximab
# (Avsola
### ®
# , Inflectra
### ®
```

**PDF data:**
- Body title spans: sz=20.2 font=Georgia-Bold
- Superscript ® spans: sz=13.0 font=Georgia-Bold
- Same y-position (same visual line), different font size

**Root cause in pdf.ts:** `renderPdfPageText` assigns one fontSize/fontName per line based on the first text item. When a line mixes sizes (superscript), each fragment gets classified independently. The `®` at 13pt triggers H3 while the 20pt text gets H1.

**Fix:** Detect superscript patterns: items significantly smaller than their neighbors on the same y-coordinate whose text is a known symbol (`®`, `™`, `©`, superscript ordinals). Fold them into the surrounding text and inherit the line's dominant font classification.

**Detection rule:** If an item's fontSize is < 75% of the previous item's fontSize on the same y-row, and the text matches `/^[®™©°¹²³]+$/`, treat it as superscript and merge into the preceding item.

## Issue 2: Tables Rendered as Flat Text (Critical)

**Symptom:** 12+ pages of HCPCS and diagnosis code tables render as plain text with no column structure.

```markdown
**HCPCS Code Description**
J1745 Injection, infliximab, excludes biosimilar, 10 mg
Q5103 Injection, infliximab-dyyb, biosimilar, (Inflectra), 10 mg
```

**PDF data (page 7, table region y=444..722):**
Every row has exactly 2 items snapping to consistent x-positions:
- Header row: x=48 + x=322
- Data rows: x~65 + x~128
- 19 consecutive rows with the same 2-column pattern

**Contrast with prose (page 2):**
- Variable item counts per row (1 to 4)
- 45+ distinct x-positions
- No consistent column alignment

**Root cause:** pdfjs-dist provides no table structure. The converter has no x-position alignment heuristic.

**Fix:** After collecting all items for a page, group by y-position into rows. For each row, record the set of x-position clusters. When 3+ consecutive rows share the same column count and their x-positions snap to the same clusters (within tolerance ~10pt), emit a markdown table.

**Safeguards:**
- Minimum 3 consecutive matching rows to activate
- Minimum 2 distinct x-clusters per row
- Skip if column count varies between rows
- Only activate when items-per-row matches column count (no wrapped text within cells)

**The signal is unambiguous.** Table rows: 2 items, same x-positions, 19+ rows. Prose: 1-4 items, scattered x-positions. False positive risk is very low with conservative thresholds.

## Issue 3: Nested List Indentation Lost (High)

**Symptom:** The PDF uses 4 indentation levels for criteria (x=36, x=54, x=72, x=90). All flatten to the same level.

```markdown
**o Both of the following:**
Documentation of a trial of at least 14 weeks...
```

Should be:
```markdown
- **One of the following:**
  - **Both of the following:**
    - Documentation of a trial of at least 14 weeks...
```

**PDF data (page 2):**
- x=36: top-level prose
- x=54: first-level bullets (with `o` from CourierNewPSMT as bullet char)
- x=72: sub-item text after `o` bullet
- x=90: continuation/sub-sub-items

**Root cause:** Two problems:
1. The `o` character from Courier font is used as a bullet but is not in `BULLET_CHAR_PATTERN`
2. x-position is not used to determine nesting depth

**Fix:**
- Add detection for `o` in a non-body font (CourierNewPSMT) at x-positions consistent with bullet indentation
- Compute indentation levels from x-position: establish a base-x from body text, then each ~18pt step = one indent level
- Map indent levels to markdown nested list syntax (`  - ` per level)

## Issue 4: Page Header/Footer Noise (High)

**Symptom:** Every page repeats the same header and footer text inline with content:

```markdown
Infliximab (Avsola ®
, Inflectra ®, Remicade ®, & Renflexis ®) Page 2 of 29
UnitedHealthcare Commercial Medical Benefit Drug Policy Effective 02/01/2026
Proprietary Information of UnitedHealthcare. Copyright 202 6 United HealthCare Services, Inc.
```

This appears 29 times, breaking the document flow.

**PDF data:**
- Header text at y~745 on every page, font sz=9.0 ArialMT
- Footer text at y~756 and y~766 on every page
- Body text at y=45..730 (varies by page)

**Fix:** Multi-page detection:
1. After extracting all pages, collect text items at extreme y-positions (top 5% and bottom 5% of page height)
2. If the same text (normalized, with page numbers wildcarded) appears at the same y-band on 3+ pages, classify as header/footer
3. Strip those items before rendering

**Alternative simpler approach:** Detect "Page N of M" pattern and strip the entire line plus adjacent lines at the same y-band.

## Issue 5: Kerning-Induced False Spaces (Medium)

**Symptom:** Text renders as `202 6` instead of `2026`, `HealthCare` instead of `Healthcare`.

**Root cause:** `shouldInsertSpace` inserts a space when items have any gap. Some PDFs use explicit character positioning (kerning) that creates tiny gaps between characters in the same word.

**Fix:** Use the item's `width` property. Calculate the gap between the end of the previous item (prevItem.transform[4] + prevItem.width) and the start of the current item (item.transform[4]). If gap < 0.3 * average character width for the font size, suppress the space.

pdfjs-dist TextItem provides `width` on each item, so this data is available.

## Issue 6: Line-Level Bold Classification Too Coarse (Medium)

**Symptom:** Lines with mixed bold/regular spans get classified entirely as bold or entirely as regular.

```markdown
** See Benefit Considerations**
```

Should be inline bold within a sentence, not a standalone bold block.

**PDF data:** A single visual line may contain spans from both Arial-BoldMT and ArialMT. Currently `classifyLine` uses the first span's fontName to decide the whole line.

**Fix:** Track font changes within a line. When flushing a line, emit `**...**` markers around consecutive bold spans rather than wrapping the entire line. This is a deeper change to `renderPdfPageText` since it currently operates at line granularity.

## Issue 7: TOC Dot Leaders (Low)

**Symptom:** Table of contents entries include dots:
```markdown
Coverage Rationale ............................................................ 1
```

**Fix:** Strip runs of 3+ repeated `.` optionally followed by a page number at end of line. Pattern: `/\s*\.{3,}\s*\d*$/`

## Implementation Priority

| # | Issue | Risk | Effort | Value |
|---|-------|------|--------|-------|
| 1 | Superscript folding | Low | Low | High (fixes title fragmentation in many PDFs) |
| 2 | Header/footer stripping | Low | Medium | High (removes noise on every page) |
| 5 | Kerning-aware spacing | Low | Low | Medium (fixes word-splitting artifacts) |
| 7 | TOC dot stripping | Low | Low | Low (cosmetic) |
| 3 | Nested indentation | Medium | Medium | High (preserves document hierarchy) |
| 4 | Table detection | Medium | High | Very High (recovers 12+ pages of structured data) |
| 6 | Inline bold spans | Medium | High | Medium (more accurate formatting) |

Items 1, 2, 5, 7 are safe, additive heuristics that should not affect existing passing tests. Items 3, 4, 6 touch core rendering logic and need careful test coverage.

## Library Decision

**Stay with pdfjs-dist.** Rationale:
- pdfjs-dist already provides all needed positional data (x, y, width, fontSize, fontName per TextItem)
- It works in both browser and Node (doc2md supports both)
- Adding pymupdf (30MB C library) or tabula (Java) would break browser compatibility or require dual code paths
- The x-position signal for table detection is unambiguous in the data we examined
- No new dependency needed for any of the seven improvements

## Test Document

The `infliximab-remicade-inflectra.pdf` exercises all seven issues and should be added as a test fixture. It is a publicly available UHC policy document.
