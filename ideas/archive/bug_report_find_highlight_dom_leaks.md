# Bug: Find highlight DOM mutation leaks between Preview and Edit

## Status

Fixed and merged in PR #123 (`ux-bugfixes-May12`, merged 2026-05-13). The direct-DOM mutation helpers (`applyRenderedFindHighlight`, `clearRenderedFindHighlight`, `findTextPosition`, `textNodesFor`, `removeEmptyRenderedInlineElements`) were deleted and replaced with the `findHighlightRehype` plugin that injects `<mark>` into the hast AST. Regression covered by `tests/e2e/find-highlight-leak.spec.ts`.

## Symptoms

Two related symptoms, both observed in the Mac app, both rooted in
the same code path.

### Symptom A — search in Preview "starts editing in preview"

1. Open a document in Preview.
2. Open find (Cmd+F), type a search term.
3. After the first match navigation, the visible preview text begins
   to reflow as the user navigates between matches. Characters shift,
   `<mark>` artifacts appear briefly, and on pressing Enter to go to
   the next match the rendered text changes in ways that look like
   the user is editing the document.
4. The active match itself does not always light up — sometimes the
   highlight is missing entirely.

Reported with screenshot at `~/Desktop/find but edits.png`.

### Symptom B — Edit-view content leaks into Preview after find

1. With find active in Edit mode, navigate matches.
2. Switch to Preview.
3. Fragments of the editor's rendered DOM appear at the top of the
   Preview surface (the user described this as "part of the edit view
   showing up in the preview"). The leak persists across further mode
   switches until the entry is closed and re-opened.

Reported with screenshot at `~/Desktop/bug2.png`.

A prior occurrence in the opposite direction (preview leaking into
edit) was patched by clearing highlights in `switchMode` before
unmount (`PreviewPanel.tsx:686-703`), but symptom B suggests the
cleanup is incomplete.

## Root cause

The rendered-surface find highlight is implemented by **mutating the
React-managed DOM directly**. See
`src/components/PreviewPanel.tsx:202-217` (`clearRenderedFindHighlight`)
and `:259-294` (`applyRenderedFindHighlight`).

```ts
// applyRenderedFindHighlight (paraphrased)
const range = document.createRange();
range.setStart(start.node, start.offset);
range.setEnd(end.node, end.offset);
const highlight = document.createElement("mark");
highlight.append(range.extractContents());
range.insertNode(highlight);
```

```ts
// clearRenderedFindHighlight (paraphrased)
for (const highlight of root.querySelectorAll("mark.markdown-rendered-find-highlight")) {
  highlight.replaceWith(...Array.from(highlight.childNodes));
}
root.normalize();
removeEmptyRenderedInlineElements(root);
```

This works visually in the short term but the mutated DOM is **not
the DOM React thinks it owns**. The sequence that produces the bugs:

1. ReactMarkdown renders `<div class="markdown-surface">...rendered
   children...</div>`. React holds a virtual DOM tree matching that
   shape.
2. User opens find. `applyRenderedFindHighlight` walks the actual
   DOM, finds the matched character range, calls
   `range.extractContents()` (detaches a chunk of nodes from
   their parents), wraps it in a `<mark>`, and inserts the `<mark>`
   back. The actual DOM tree shape now differs from React's virtual
   tree.
3. Anything that causes a re-render of `ReactMarkdown` (source
   change, mode switch, parent re-render, even React 18's automatic
   batching that schedules a fresh render) will reconcile against
   the actual DOM. React's reconciliation does not see the
   `<mark>` as part of its tree, but it may inherit live text nodes
   from beneath the `<mark>` when patching its own virtual tree
   back into the real DOM. Result: text fragments shift visibly,
   the `<mark>` may be left orphaned, and DOM subtrees from one
   mode can survive into another mode's mount because React's
   "remove these nodes" pass operates on the virtual tree, not on
   the mutated subtree.
4. The character-level reflow during reconciliation is what the
   user perceives as "editing happening on its own".

Direct DOM mutation of React-managed children is a documented
anti-pattern; React does not guarantee anything about subtrees its
reconciler did not produce.

## Proposed fix

Replace the post-render DOM mutation with **a remark plugin that
injects `<mark>` nodes into the markdown AST during render**, keyed
on `activeFindMatch`. React then owns the highlight from creation to
unmount, and the reconciler has no surprise mutations to deal with.

### Sketch

```ts
// src/components/findHighlightPlugin.ts
import type { Plugin } from "unified";
import type { Root } from "mdast";

interface Options {
  match: { start: number; end: number } | null;
  className: string; // "markdown-rendered-find-highlight"
}

export const findHighlightPlugin: Plugin<[Options], Root> = ({ match, className }) => {
  return (tree, file) => {
    if (!match) return;
    // walk text nodes in the AST, find the one(s) containing the
    // match's char-offset range, split them into [prefix, matched,
    // suffix] and wrap the matched portion in a synthetic node that
    // the rehype stage knows how to render as <mark className={...}>.
  };
};
```

Wire it into the existing `<ReactMarkdown remarkPlugins={[remarkGfm, findHighlightPlugin({ match: activeFindMatch, className: HIGHLIGHT_CLASS })]}>` call at `PreviewPanel.tsx:828`.

Then delete:

- `applyRenderedFindHighlight` (`PreviewPanel.tsx:259-294`)
- `clearRenderedFindHighlight` (`PreviewPanel.tsx:202-217`)
- `findTextPosition`, `textNodesFor`, `removeEmptyRenderedInlineElements`
  (only callers of the above)
- the `clearRenderedFindHighlight` call in `switchMode`
  (`PreviewPanel.tsx:694-700`) — no longer needed once nothing
  mutates the DOM
- the `setRenderedViewText` machinery used to trigger
  `applyRenderedFindHighlight` re-runs

Replace the rendered-text-buffer state with whatever offset model
the remark plugin expects. The plugin probably needs the same
`{start, end}` offsets that `useFindReplace` already exposes.

### Edge cases to test

- Plain text match — `<mark>` wraps a span of characters in a `<p>`.
- Match across inline emphasis: `**bold** text` where the match
  starts inside `<strong>` and ends outside it. The plugin must
  split the AST nodes correctly.
- Zero-width match (regex matching at a position): the existing
  `markdown-rendered-find-highlight-zero` class shows a 2px caret.
  The plugin needs an equivalent.
- Match at start-of-document or end-of-document (offset 0 or
  `source.length`).
- Match navigation: stepping through matches must not cause the
  surface to scroll unrelated content; the existing
  `centerElementInScrollContainer` call on the highlight stays as
  a post-render layout effect (find the rendered `<mark>` and
  scroll it into view), but it's now a *read* of React-rendered
  DOM, not a mutation.

## Acceptance

- Search in Preview, navigate matches: each match lights up; no
  character-level reflow during navigation; pressing Enter advances
  through matches and does not produce visible edits in the
  document text.
- Switch Preview → Edit → Preview with find active across the
  transitions: no fragments of either surface persist into the
  other.
- Switch with find closed: no change to current behavior.
- The 506 Vitest cases still pass. The Playwright anchor spec at
  `tests/e2e/view-anchor-mode-switch.spec.ts` still passes. Add at
  least one Playwright case that opens find on a fixture, navigates
  three matches across emphasis nodes, and asserts the rendered
  text content is unchanged.

## Effort

2-3 hours. Most of the time is in the remark plugin's
text-node-splitting logic for cross-emphasis matches. The rest is
deletion of the now-dead DOM-mutation code.

## Status

Documented. Not yet fixed. Tracked alongside
`bug_report_find_match_scrolls_to_wrong_line.md` so the find feature
gets one cohesive fix-pass.

## Related architectural note

This bug is the headline example in `ideas/archive/preview-panel-refactor.md`
for why `PreviewPanel.tsx` is overloaded: a fix here naturally
becomes the new `useFindHighlight` module described in that roadmap.
Doing this bug fix is the first step of the refactor.
