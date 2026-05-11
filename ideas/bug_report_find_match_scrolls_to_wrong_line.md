# Bug: Find match scrolls to the wrong line in the editor

## Symptom

In Edit mode, open find (Cmd+F), search for a term, and navigate to a
match. The textarea scrolls — but the match lands several lines off
from the line that actually contains the match, especially when the
source has soft-wrapped paragraphs above the match.

Reported with a screenshot at `~/Downloads/match-on-wrong-line.png`.

## Root cause

There are two scroll-to-position implementations living side by side
in this codebase:

1. `scrollTextareaToLine(textarea, mirror, source, line, viewportTopFloor)`
   in `src/components/viewportAnchor.ts:274-302` — the mirror-measured
   helper used by the view-anchor mode-switch feature. It walks the
   `<pre>` mirror's actual text nodes with `Range.getBoundingClientRect()`
   so soft-wrap, font metrics, and padding are all measured live.

2. `scrollTextareaToMatch(textarea, source, match)` in
   `src/components/PreviewPanel.tsx:159-174` — an older helper. It
   *estimates* the target by reading `getComputedStyle(textarea).lineHeight`
   and computing
   `targetScroll = (linesBeforeMatch - 1) * estimatedLineHeight - (clientHeight - estimatedLineHeight) / 2`.
   That estimation collapses to a single line height per source line,
   which is wrong for soft-wrapped paragraphs: a long paragraph
   wrapping to 5 visual rows still counts as 1 in
   `linesBeforeMatch`, but the textarea has actually rendered it
   across 5 rows. Net result: the offset between estimated and
   actual position grows by roughly `(wrapped_rows_above_match - 1) *
   lineHeight` for every wrapped paragraph above the match.

Only `scrollTextareaToMatch` is wired into the find-active-match
layout effect at `src/components/PreviewPanel.tsx:483-494`. The find
feature never got migrated to the mirror-measured helper.

## Proposed fix

Delete `scrollTextareaToMatch` entirely. Route the find-active-match
effect through the same `scrollTextareaToLine` (and
`scrollRenderedToLine` for rendered surfaces) helpers used by
viewport anchoring.

The active-match effect at `PreviewPanel.tsx:483-494` becomes:

```ts
useLayoutEffect(() => {
  if (
    mode !== "edit" ||
    !isFindOpen ||
    !activeFindMatch ||
    !textareaRef.current ||
    pendingAnchorLineRef.current !== null ||
    !shouldCenterActiveMatch()
  ) {
    return;
  }

  const matchLine =
    effectiveMarkdown.slice(0, activeFindMatch.start).split("\n").length;
  scrollTextareaToLine(
    textareaRef.current,
    findHighlightRef.current,
    effectiveMarkdown,
    matchLine,
    viewportTopFloor(),
  );
  syncFindHighlightScroll();
}, [activeFindMatch?.end, activeFindMatch?.start, activeFindMatch,
    effectiveMarkdown, isFindOpen, mode]);
```

Optionally keep the "center the match in the viewport" semantic by
calling `scrollTextareaToLine` with a `viewportTopFloor` value that
biases the match to the middle of the visible content area instead of
the top. That's a small extension to the existing helper — accept an
optional `offsetFraction` (default 0 = top-aligned, 0.5 = centered).

Also remove the corresponding centering math in
`src/components/useFindReplace.ts:337-353` (`setActiveSelection`) for
the same reason — that helper has the same line-height estimation bug
and is currently unused but ready to mislead a future caller.

## Acceptance

- Open a doc with at least two long wrapped paragraphs above a known
  match.
- Cmd+F, type the match term.
- Active-match navigation scrolls the textarea so the match is visible
  near the top of the visible content area (or centered, per the
  chosen offset), within one line of accuracy regardless of wrap.
- The find-overlay `<mark>` highlight stays aligned with the
  underlying text (existing `syncFindHighlightScroll` call covers
  this).
- Existing 506 Vitest cases still pass; the
  `tests/e2e/view-anchor-mode-switch.spec.ts` spec is unaffected
  because find-active-match is a separate code path.

## Effort

About 1 hour. One file change in `PreviewPanel.tsx`, one cleanup in
`useFindReplace.ts`, possibly one extension to `viewportAnchor.ts` for
the centering offset. No new tests strictly required; existing find
unit cases already check `setSelectionRange` collapsed-caret
behavior, which is independent of the scroll math.

## Status

Documented. Not yet fixed. Land alongside the
`bug_report_find_highlight_dom_leaks.md` work so the find feature gets
fixed in one focused pass.
