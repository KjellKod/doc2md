# 042 — Find-in-Preview Table Cells

PR #127 closed with a promise. The Phase 1 refactor of `PreviewPanel.tsx` was sold as a structural move whose payoff would be measured the next time a bug arrived at this seam: would the fix be smaller than it would have been against the 1285-line predecessor? PR #128 was the test of that promise, and the answer is yes.

## What landed

`fix(find): inject virtual cell separators in preview corpus`. Five files, +331/-10. One new module, two existing files touched, two new test cases. The bug report had described it cleanly in March-form:

> Single-cell substring queries match correctly. Multi-cell queries fail to match anything. The corpus comes from `element.textContent` which concatenates cell text with no separator.

The fix is what the report sketched as Option 1: a DOM walk that emits a virtual space at `<td>`/`<th>`/`<dt>`/`<dd>`/`<li>` close and a newline at `<tr>`/`<p>`/`<div>`/`<br>`/heading close. What I learned during implementation was that the offset rule has to live in TWO places, not one: the corpus walk (so `useFindReplace` finds the phrase) AND the hast walk (so the `<mark>` lands on the right characters).

The shared helper `src/components/preview/renderedTextCorpus.ts` is what enforces that. Both walkers call the same `elementBoundarySeparator(tagName)` and use the same rule. Drift is impossible by construction.

## The bug that almost shipped twice

I had implemented both walks and hit a wall when the e2e test showed marks oscillating between 7 and 0. The unit test I added with a synthetic table also got 7 marks instead of 2. The hast walk was advancing cursor by way more chars than the rendered DOM contained, putting marks at offsets way past the visible text.

The reason was instructive: `remark-gfm` emits whitespace-only text nodes ("\n") between every element inside table-shaped parents. React strips them when rendering to DOM, so they don't appear in the textContent or in my DOM walk's output. But they DO appear in the hast tree, so the hast cursor was counting them as 1 character each.

Fix: a `TEXT_STRIPPING_PARENTS` set (`table`, `thead`, `tbody`, `tfoot`, `tr`, `ul`, `ol`, `dl`) plus an `isWhitespaceOnly(value)` check. When walking children of one of those parents, skip whitespace-only text nodes. The cursor then matches the DOM corpus byte-for-byte.

This is the kind of subtlety that would have been a nightmare to debug against the pre-refactor `PreviewPanel.tsx`. The rendered corpus was entangled with eight other concerns in one 1285-line file. Today the corpus computation lives in a 72-line module with one caller. The hast walk lives in 195 lines. Both have unit tests. The bug had exactly two places to be wrong, and both were obvious in diff.

## Reproduction-first held

Per the discipline that's now ritualistic on this branch: `3902843` added the failing reproduction (5 e2e cases, 3 failing on pre-fix main), `4c0e7a0` flipped them green plus added a unit test pinning the offset math, `0636bd8` cleaned an unused-helper lint flag. Three commits, each focused, each runnable in isolation. A reviewer can checkout `3902843` and watch 3 of 5 tests fail against the not-yet-fixed code, then checkout `4c0e7a0` and watch the same 5 tests go green.

I had to instrument my own code to find the whitespace-text-node bug. I added a `console.log` of the hast tree and one of the corpus, ran the unit test, saw the inter-element `\n` nodes in the hast that my DOM walk never saw, and the path forward became obvious. Diagnostic logs removed before commit. The instrumentation gap is real: I wish there were a built-in `hast-diff` tool for "what does the hast tree look like at the moment the rehype plugin runs," but I made do with five lines of `JSON.stringify` and `grep`.

## The promise paid off

Phase 1's refactor cost 1683 lines of refactor diff to land. The table-cell fix cost 321 lines of diff. That ratio is the only metric that matters: structural work earns its keep by making the next behavior change cheaper. If it doesn't, refactors are theater. This one earned its keep on the very next bug.

The next promise outstanding is Phase 2: AppShell dedup of `App.tsx` and `DesktopApp.tsx`. The quest brief is already written at `ideas/quest-briefs/preview-panel-refactor-phase-2.md`. The next bug that lands in either of those files will tell us if Phase 2's promise will pay the same way.

— Jean-Claude
