**Agent:** Planner (Jean-Claude)
**Model:** claude-opus-4-6
**Date:** 2026-03-31
**Quest ID:** linkedin-unicode-preview_2026-03-31__2103

# LinkedIn/Unicode Preview Mode

## Overview

**Problem**: Users want to copy Markdown content into LinkedIn posts, but LinkedIn uses plain text with no Markdown rendering. There is no way to preview what the content would look like when pasted into a plain-text context that supports Unicode formatting.

**Impact**: Users converting documents to Markdown can preview a LinkedIn-ready plain-text version directly in the app, copy it, and paste it into LinkedIn without manual reformatting.

**Scope**:
- **In**: A third view mode ("LinkedIn") alongside Edit and Preview in PreviewPanel; a new `formatLinkedInUnicode` function in a dedicated module; detection and refusal of unsupported constructs (tables, HTML tags); unit and component tests.
- **Out**: Download flow for LinkedIn format. Export/save-as. Clipboard copy button (nice-to-have, not in scope). Changes to the conversion pipeline or file types.

## Acceptance Criteria

1. The preview toggle shows three buttons: Edit, Preview, LinkedIn (recommended label, see Open Questions).
2. Clicking LinkedIn renders the effective markdown as plain text with Unicode formatting in a read-only `<pre>` or styled `<div>` (not rendered via ReactMarkdown).
3. When the markdown contains tables (`|...|` rows or separator lines), HTML tags (`<table>`, `<div>`, etc.), or other unsupported constructs, the LinkedIn view shows a clear refusal message instead of attempting partial rendering.
4. Supported constructs render as readable Unicode plain text:
   - Headings: UPPER CASE or bold Unicode with a simple underline separator line
   - Paragraphs: plain text with blank line separation
   - Unordered lists: Unicode bullet characters (e.g. `\u2022`)
   - Ordered lists: `1.`, `2.`, etc. preserved
   - Blockquotes: indented with `\u2502` or `>` prefix
   - Separators/horizontal rules: Unicode line (e.g. `\u2500` repeated)
   - Links: readable plain-text format with the URL visible, preferably `Label: URL`
   - Inline emphasis: light conversion (bold via Unicode bold if feasible, or preserved as-is)
   - Inline code: preserved with backticks or light formatting
   - Code blocks: preserved as indented plain text
5. Output is deterministic: same input always produces same output.
6. The LinkedIn button only appears when the toggle bar is shown (same conditions as Edit/Preview).
7. Switching between Edit, Preview, and LinkedIn preserves the editing state.

## Implementation Approach

### Architecture

The feature adds:
1. A new formatting module `src/components/linkedinFormatting.ts` containing the Unicode conversion logic and unsupported-construct detection.
2. A third mode value in PreviewPanel's state (`"edit" | "preview" | "linkedin"`).
3. A third toggle button in the toggle bar.
4. A new render branch in PreviewPanel for the LinkedIn mode.

### Critical Files

| File | Change Type | Description |
|------|-------------|-------------|
| `src/components/linkedinFormatting.ts` | **Create** | Core Unicode formatting logic and refusal detection |
| `src/components/linkedinFormatting.test.ts` | **Create** | Unit tests for formatting and refusal |
| `src/components/PreviewPanel.tsx` | **Modify** | Add "linkedin" mode to toggle, render LinkedIn view |
| `src/components/PreviewPanel.test.tsx` | **Modify** | Add tests for LinkedIn toggle button and refusal UI |

### Data Flow

```
effectiveMarkdown
  -> detectUnsupportedConstructs(markdown)
     -> if unsupported: render refusal message
     -> if supported: formatLinkedInUnicode(markdown) -> render as <pre> plain text
```

### Key Functions

#### `src/components/linkedinFormatting.ts`

**`detectUnsupportedConstructs(markdown: string): string | null`**
- Returns `null` if content is safe to render, or a human-readable refusal reason string.
- Detects: table lines (`|...|` patterns, separator rows), HTML tags (`<tag>`, `</tag>`, self-closing), table-specific HTML (`<table>`, `<tr>`, `<td>`, `<th>`).
- Uses line-by-line scanning plus a simple HTML tag regex.

**`formatLinkedInUnicode(markdown: string): string`**
- Converts supported Markdown constructs to Unicode plain text.
- Line-by-line processing with state tracking for code blocks.
- Heading lines (`# ...`): strip `#` markers, output text in caps or as-is with an underline row of `\u2500`.
- List items (`- `, `* `, `+ `): replace marker with `\u2022 `.
- Ordered list items (`1. `): keep as-is.
- Blockquotes (`> `): replace with `\u2502 ` prefix.
- Horizontal rules (`---`, `***`, `___`): replace with `\u2500` repeated ~30 chars.
- Links `[text](url)`: convert to `Label: URL`, and allow Markdown autolinks like `<https://example.com>`.
- Inline bold/italic (`**text**`, `*text*`, `__text__`, `_text_`): strip markers (bold Unicode mapping is complex and fragile, simple stripping is more reliable for copy-paste).
- Inline code (`` `code` ``): preserve backticks.
- Fenced code blocks: strip fence markers, indent content by 4 spaces.
- Blank lines: collapse to single blank line (same as existing preview logic).

#### `src/components/PreviewPanel.tsx`

- Mode type changes from `"edit" | "preview"` to `"edit" | "preview" | "linkedin"`.
- Third button added to the toggle group.
- New render branch: when `mode === "linkedin"`, call `detectUnsupportedConstructs`. If refusal, show a styled message. If clean, call `formatLinkedInUnicode` and render in a `<pre className="linkedin-surface">` element.
- Default mode remains "preview" for non-scratch entries.

## Validation Plan

### Automated Tests

**Automated Test**: LinkedIn formatting of supported constructs
- **File**: `src/components/linkedinFormatting.test.ts`
- **Tests**: `test_headings_render_with_underline`, `test_unordered_list_uses_unicode_bullets`, `test_ordered_list_preserved`, `test_blockquote_uses_bar`, `test_horizontal_rule_uses_unicode_line`, `test_links_render_as_text_url`, `test_inline_emphasis_stripped`, `test_code_blocks_indented`, `test_paragraphs_separated_by_blank_lines`, `test_deterministic_output`
- **Run**: `npx vitest run src/components/linkedinFormatting.test.ts`
- **Covers**: Each supported construct type, blank line collapsing, determinism
- **Mocking**: None

**Automated Test**: Refusal detection for unsupported constructs
- **File**: `src/components/linkedinFormatting.test.ts`
- **Tests**: `test_detects_markdown_table`, `test_detects_html_table_tags`, `test_detects_generic_html_tags`, `test_returns_null_for_clean_markdown`
- **Run**: `npx vitest run src/components/linkedinFormatting.test.ts`
- **Covers**: Table pipe syntax, HTML table elements, generic HTML tags, clean content
- **Mocking**: None

**Automated Test**: PreviewPanel LinkedIn toggle and refusal UI
- **File**: `src/components/PreviewPanel.test.tsx`
- **Tests**: `test_linkedin_button_visible_for_success_entry`, `test_linkedin_mode_renders_unicode_output`, `test_linkedin_mode_shows_refusal_for_tables`, `test_linkedin_button_not_visible_for_pending_entry`
- **Run**: `npx vitest run src/components/PreviewPanel.test.tsx`
- **Covers**: Toggle visibility, mode switching, refusal message display
- **Mocking**: None (component test with real formatting functions)

**MANUAL TEST**: End-to-end LinkedIn preview copy-paste
- **Why manual**: Requires visual inspection and actual LinkedIn paste behavior
- **Preconditions**: Dev server running (`npm run dev`)
- **Steps**:
  1. Drop a Markdown file with headings, lists, and paragraphs
  2. Click the LinkedIn toggle button
  3. Visually confirm Unicode formatting looks readable
  4. Select all text in the LinkedIn preview, copy
  5. Paste into a LinkedIn post draft
  6. Confirm formatting survives the paste
- **Expected**: Clean plain text with Unicode bullets and separators, readable in LinkedIn
- **Observability**: Visual inspection of the preview pane and LinkedIn post editor

**MANUAL TEST**: Refusal for tables
- **Why manual**: Visual confirmation of refusal UX
- **Steps**:
  1. Create or upload a Markdown file containing a pipe table
  2. Click the LinkedIn toggle
  3. Confirm refusal message appears instead of garbled output
- **Expected**: Clear message explaining tables are not supported in LinkedIn format

## Integration Touchpoints

**PreviewPanel toggle group**: Adding a third button to the existing two-button toggle. Could break: layout or styling of the toggle bar. Validation: visual check in both light and dark themes, existing toggle tests still pass.

**previewFormatting.ts**: Not modified. The LinkedIn formatter is a separate module, not a modification of the existing preview pipeline. Could break: nothing, isolated. Validation: existing `previewFormatting.test.ts` tests still pass.

**CSS/styling**: New `.linkedin-surface` class needed for the `<pre>` output and a `.linkedin-refusal` class for the refusal message. Could break: theme consistency. Validation: visual check in dark mode.

## Risks

1. **Unicode character rendering across platforms** - Impact: M, Likelihood: L - Mitigation: Use only widely supported Unicode characters (bullets, box-drawing). Avoid exotic Unicode bold/italic mappings.

2. **Regex edge cases in refusal detection** - Impact: M, Likelihood: M - Mitigation: Test with realistic Markdown samples. Keep detection conservative (false positive refusal is safer than garbled output).

3. **Toggle bar layout with three buttons** - Impact: L, Likelihood: L - Mitigation: The existing CSS uses flexbox with gap, a third button should flow naturally. Verify on narrow viewports.

4. **Copy-paste fidelity** - Impact: M, Likelihood: L - Mitigation: Use `<pre>` to preserve whitespace and line breaks. Manual test confirms paste behavior.

## Implementation Phases

### Phase 1: Core formatting module
Create `linkedinFormatting.ts` with `detectUnsupportedConstructs` and `formatLinkedInUnicode`. Write comprehensive unit tests.

### Phase 2: PreviewPanel integration
Add third mode, toggle button, and render branch. Write component tests. Add minimal CSS for `.linkedin-surface` and `.linkedin-refusal`.

### Phase 3: Visual polish and manual testing
Verify light/dark theme, narrow viewport, copy-paste behavior. Run full test suite.

## Open Questions

- [ ] **Label wording**: "LinkedIn" vs "LinkedIn/Unicode" vs "Unicode" for the toggle button. Recommendation: **"LinkedIn"** as the shortest, clearest label that signals intent. The underlying mechanism (Unicode) is an implementation detail users do not need to see.
- [ ] **Refusal message copy**: Exact wording for the unsupported-construct message. Recommendation: "This content includes tables or HTML that cannot be converted to plain-text LinkedIn format. Remove those sections and try again."
