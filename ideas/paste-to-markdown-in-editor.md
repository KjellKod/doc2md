# Paste to Markdown in Editor

## Problem

When pasting formatted text into the edit mode textarea, the content arrives as-is. Unicode-formatted text (LinkedIn-style mathematical bold U+1D400-1D433, italic U+1D434-1D467, strikethrough with U+0336, underline with U+0332) keeps its unicode characters instead of being converted to markdown syntax. Rich text (HTML from clipboard) also pastes as raw text.

This means content round-trips poorly: copy from LinkedIn, paste into editor, and the result is neither clean plain text nor valid markdown.

## Expected Behavior

Pasting into the edit textarea should convert incoming content to markdown:

1. **Unicode mathematical bold** (𝐛𝐨𝐥𝐝) to `**bold**`
2. **Unicode mathematical italic** (𝘪𝘵𝘢𝘭𝘪𝘤) to `*italic*`
3. **Unicode mathematical bold-italic** to `***bold-italic***`
4. **Combining strikethrough** (s̶t̶r̶u̶c̶k̶) to `~~struck~~`
5. **Combining underline** to plain text (markdown has no underline)
6. **Rich text (HTML) from clipboard** to markdown (headings, lists, bold, italic, links)

If full HTML-to-markdown is too ambitious for a first pass, the unicode reverse conversion alone is high value since it directly supports the LinkedIn workflow (convert doc to markdown, format for LinkedIn, then users paste LinkedIn text back for editing).

## Implementation Notes

- The reverse of `formatLinkedInUnicode()` in `linkedinFormatting.ts` already maps ASCII to unicode math chars. A reverse mapping function would invert that table.
- Intercept the `paste` event on the edit textarea.
- Check `clipboardData.types` for `text/html` (rich paste) vs `text/plain` (plain paste with possible unicode chars).
- For plain text: scan for unicode math bold/italic ranges and convert to markdown inline formatting.
- For HTML: use a lightweight HTML-to-markdown converter (e.g. Turndown, or a minimal custom one).
- The textarea `onChange` handler already exists. The paste handler would preprocess before the value hits state.

## Scope

- IN: Unicode formatting reversal on paste (LinkedIn round-trip)
- IN: Basic rich text to markdown on paste (bold, italic, headings, lists, links)
- OUT: Complex HTML structures (nested tables, embedded media)
- OUT: Changes to copy behavior (already handled by separate quest)

## Priority

Medium. Directly improves the LinkedIn workflow, which is a primary use case for doc2md.
