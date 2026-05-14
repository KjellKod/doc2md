# Quest Brief: PreviewPanel Refactor — Phase 1 (Mode Split + Anchor/Find Hooks)

Copy the block below (between the fences) into `/quest` to start the run. The brief was written to be pasted verbatim; do not edit it unless you are changing scope.

```
Quest brief: PreviewPanel Refactor — Phase 1

Context

- Source proposal: ideas/preview-panel-refactor.md. Read it first.
- Companion bug (open, do NOT fix in this quest): ideas/bug_report_find_preview_table_cells.md.
- Companion bugs (closed, reference only): ideas/archive/bug_report_find_highlight_dom_leaks.md, ideas/archive/bug_report_find_match_scrolls_to_wrong_line.md.
- Current file sizes (worth quoting back if anyone challenges the scope): src/components/PreviewPanel.tsx ~1285 lines, src/App.tsx ~1306, src/desktop/DesktopApp.tsx ~2911. The proposal cited 1038 / 756 / 2239 — every file got bigger, not smaller. This is the load-bearing reason recent find / anchor / mode-switch bugs keep landing in the same component.
- PR #123 already converted the find-highlight pipeline from direct DOM mutation to a rehype plugin (src/components/findHighlightRehype.ts). The "kill DOM mutation" step from the proposal is therefore largely done. What remains in Phase 1 is the structural split of PreviewPanel.tsx into mode components and the extraction of two hooks. Phase 2 (App.tsx + DesktopApp.tsx → AppShell) is OUT OF SCOPE for this quest and will be a separate quest.

Goal

Split src/components/PreviewPanel.tsx into a thin shell plus three mode components and two hooks, preserving 100% of current behavior. No functional change. No bug fixes. No new features. Just structural surgery that makes each mode's surface, ref, anchor capture, and highlight rendering owned by its own component, so future find / anchor / mode-switch fixes have a small blast radius instead of a 1285-line one.

Target shape (from the proposal):

```
src/components/preview/
  PreviewPanel.tsx          // thin shell: mode switcher + toolbar + body slot
  EditMode.tsx              // textarea + mirror + edit-mode anchor wiring
  PreviewMode.tsx           // markdown surface + rehype + preview-mode anchor wiring
  LinkedInMode.tsx          // per-line spans + linkedin-mode anchor wiring
  useViewportAnchor.ts      // capture/apply hook wrapping viewportAnchor.ts helpers
  useFindHighlight.tsx      // wraps findHighlightRehype plugin + match-overlay rendering
```

The three mode components are siblings, conditionally mounted by the shell. They share state via a small props contract: entry, effectiveMarkdown, activeFindMatch, isFindOpen, onMarkdownChange. Nothing else. The existing src/components/PreviewPanel.tsx import path stays valid (re-export from preview/PreviewPanel or move the file); src/desktop/DesktopApp.tsx and src/App.tsx do not change.

Required scope

Driven test-first. The current PreviewPanel is dense; the only safe refactor is one that locks behavior in tests BEFORE structure changes.

1. Characterization test pass (do this BEFORE moving any code).
   - Audit existing Playwright coverage in tests/e2e/. The find / anchor / mode-switch seam is already covered by: find-edit-overlay-wrap.spec.ts, find-highlight-leak.spec.ts, find-linkedin-highlight.spec.ts, find-match-scroll.spec.ts, find-replace-single-undo.spec.ts, find-replace-whole-word.spec.ts, view-anchor-mode-switch.spec.ts. Audit existing unit coverage in src/components/__tests__/ (findHighlightRehype.test.tsx, PreviewPanel.test.tsx, etc.).
   - Identify behavior gaps. At minimum, add coverage for:
     a. Find highlight is rendered ONLY by the active mode's surface (no orphan <mark> nodes in inactive-mode trees after mode switch).
     b. Viewport anchor survives mode switch on a soft-wrapped paragraph (currently covered, confirm and extend if thin).
     c. Edit-mode textarea and Preview-mode rendered surface do not share state inappropriately (typing in edit mode does not produce ghost highlights in preview mode and vice versa).
     d. Cmd+F open / close toggles isFindOpen for the active mode only; switching modes while find is open preserves the query but re-runs the search against the new mode's corpus.
   - Run the augmented suite against current main. If any test fails on main, STOP and report. We are not fixing bugs in this quest; a failing test against main is a separate bug filing.
   - Commit the new tests as their own step (or first commit on the quest branch) so the diff that locks behavior is reviewable in isolation from the refactor diff.

2. Extract useViewportAnchor (src/components/preview/useViewportAnchor.ts).
   - Wrap the existing helpers in src/components/viewportAnchor.ts (scrollRenderedToLine, scrollTextareaToLine, topLineFromRendered, topLineFromTextareaMirror).
   - Public API: `useViewportAnchor(ref: RefObject<HTMLElement>, surfaceKind: "rendered" | "textarea")` returns `{ captureAnchorLine, applyAnchorLine }`.
   - Internal: store anchor line in a ref so mode-switch unmount-of-old-component / mount-of-new-component sequence can hand off through a parent-owned anchor ref.
   - Re-run the characterization suite. All green before proceeding.

3. Extract useFindHighlight (src/components/preview/useFindHighlight.tsx).
   - Wrap the existing findHighlightRehype plugin (src/components/findHighlightRehype.ts). Do NOT rewrite the plugin. The plugin's output and offset behavior must be byte-identical to current main.
   - Public API: `useFindHighlight({ activeFindMatch, isFindOpen, corpusSource })` returns `{ rehypePlugins, renderedTextForCorpus }` (or the equivalent — the goal is one hook that owns "given a match and a corpus, produce the rehype plugin slot and the corpus string").
   - The edit-mode renderFindHighlight helper (currently a top-level function in PreviewPanel.tsx around line 260) is parallel logic for textarea; keep it inside EditMode.tsx — do NOT fold it into useFindHighlight unless the contracts are genuinely identical. KISS over DRY when the two paths have different domains (string slicing vs. hast tree).
   - Re-run the characterization suite. All green before proceeding.

4. Extract mode components.
   - src/components/preview/EditMode.tsx: textarea, mirror, edit-mode anchor wiring, edit-mode renderFindHighlight, edit-mode formatting shortcuts (commitTargetedInsert, smartWrapInsert, toggleListLine, etc.). All edit-only state (selection refs, mirror refs) lives here.
   - src/components/preview/PreviewMode.tsx: ReactMarkdown surface, rehype pipeline (sourceLineRehype + useFindHighlight output), preview-mode anchor wiring, renderedViewText corpus computation, copy-to-clipboard preview branch.
   - src/components/preview/LinkedInMode.tsx: per-line span rendering, LinkedIn segmentation, copy-to-clipboard LinkedIn branch, LinkedIn anchor wiring.
   - The shell (src/components/preview/PreviewPanel.tsx, OR keep the file at src/components/PreviewPanel.tsx and re-export — pick one and document the choice) owns mode state, toolbar, save controls, find-bar wiring (FindReplaceBar + useFindReplace), Cmd+F interception, and the anchor handoff ref. It conditionally mounts exactly one mode component at a time.
   - The PreviewPanelProps surface stays unchanged. External callers (src/desktop/DesktopApp.tsx:10, src/App.tsx) MUST continue to import "../components/PreviewPanel" with no signature change.
   - Re-run the FULL test suite (npm test + npm run test:e2e) and the manual Mac validation pattern from CLAUDE.md memory. All green.

5. Code-quality pass.
   - SRP: each mode component owns its surface, its ref, its anchor capture, its highlight rendering, and nothing else.
   - DRY: extract shared types (PreviewPanelProps, FindMatch passthroughs) to a co-located types file under src/components/preview/ if needed; do NOT extract anything that has only one caller.
   - KISS: NO new abstractions beyond the six files listed above. No "BaseMode" class. No higher-order components. No context provider for "current mode" — the shell mounts one child and passes props. If a temptation appears to create a seventh file, push back and justify it in the plan.
   - YAGNI: do NOT preemptively add hooks for "future" modes, do NOT add a plugin registry, do NOT add config props that have no caller.

Acceptance criteria

1. src/components/PreviewPanel.tsx (or whatever the shell becomes) is at most 350 lines including imports and the export. Each of EditMode.tsx, PreviewMode.tsx, LinkedInMode.tsx is at most 500 lines. useViewportAnchor.ts and useFindHighlight.tsx are at most 200 lines each. (These are sanity ceilings, not targets — if the natural split lands meaningfully smaller, that is fine; if it lands meaningfully larger, the split is wrong.)
2. The PreviewPanelProps interface (src/components/PreviewPanel.tsx:232 on current main) is unchanged. No new optional props. No renamed props.
3. `git diff main -- src/desktop/DesktopApp.tsx src/App.tsx` shows zero changes from this quest. Phase 2 does not start here.
4. All existing Playwright specs in tests/e2e/ pass against the refactor branch without modification (no test is rewritten to match new behavior; if a test needs to change, the refactor changed behavior, which is out of scope).
5. All existing unit tests in src/components/__tests__/ pass without modification.
6. The new characterization tests added in step 1 also pass (against both the pre-refactor commit AND the post-refactor commit — that is the whole point of pinning behavior).
7. The open table-cells bug (ideas/bug_report_find_preview_table_cells.md) is NOT fixed by this quest. It is filed; it stays filed. Document in the PR description that the refactor makes the future fix smaller because the preview-mode corpus computation now lives in PreviewMode.tsx alone.
8. Manual Mac validation pattern (per CLAUDE.md memory): `npm run build:mac && open .build/mac/Build/Products/Release/doc2md.app`, then File → Open a sample .xlsx fixture and a sample .md, exercise edit/preview/linkedin mode switch, exercise find in each mode, exercise the resize handles. No regressions vs. main.

Validation

- `npm run lint && npm run typecheck && npm test && npm run test:e2e` all green on the quest branch.
- `wc -l src/components/preview/*.tsx src/components/preview/*.ts src/components/PreviewPanel.tsx 2>/dev/null` shows the split distribution and confirms the size ceilings.
- `git diff main..HEAD -- src/App.tsx src/desktop/DesktopApp.tsx` returns empty.
- `grep -rn "from .*components/PreviewPanel" src/ tests/` confirms callers still import from the same path.
- Mac manual validation pattern from CLAUDE.md memory completed and noted in the diary entry.

Constraints

- Test-first. The characterization test commits MUST precede the refactor commits. A reviewer should be able to checkout the characterization commit, run the suite against pre-refactor code, and watch it pass — then checkout the refactor commit and watch the same suite pass. That is the contract.
- No bug fixes. The find-in-table-cells bug, any anchor edge cases, any visual polish — all out of scope. If a real bug is discovered while reading the code, file it under ideas/ and keep going.
- No language changes. No new dependencies. No type system migrations. The proposal explicitly rules out rewrites.
- No touching of: src/converters/*, save semantics, Sparkle / notarization, licensing boundary, theme system.
- No touching of src/App.tsx or src/desktop/DesktopApp.tsx (Phase 2 territory).
- Pin every action by full SHA if any new workflow is added. No new workflows are anticipated for this quest.
- Honor AGENTS.md core principles: KISS, DRY (but not premature), YAGNI, SRP, strong typing. Honor the change-discipline section: minimal focused changes, no broad refactors beyond the stated scope, no "improvements" that weren't requested.

When to break the quest into PRs

- If the characterization-test commits are substantial (5+ new specs, 200+ new lines of test code), land them as their own PR FIRST so behavior is locked on main before the refactor PR opens. The refactor PR then rebases on the locked-in baseline.
- Otherwise, single PR is acceptable.

Out of scope (filed forward, not handled here)

- Phase 2: AppShell dedup of App.tsx + DesktopApp.tsx. Separate quest after this lands.
- Fix for ideas/bug_report_find_preview_table_cells.md. Separate bug, separate quest, post-refactor.
- Any change to the converter pipeline, the save state machine, the licensing boundary, or the theme system.
```

## When to run this

Run this quest after the current find / anchor bug cluster has stabilized on main (PRs #114, #122, #123 are merged; PR #124 archived diary). The open table-cells bug is intentionally NOT a prerequisite — the refactor does not depend on fixing it, and the refactor makes the future fix smaller.

## Where this came from

Extracted from `ideas/preview-panel-refactor.md` (the source proposal). The proposal lists two phases; this brief covers Phase 1 only. Phase 2 (AppShell dedup) gets its own brief once Phase 1 lands.

Companion bug references (cited inside the brief):
- `ideas/bug_report_find_preview_table_cells.md` — open
- `ideas/archive/bug_report_find_highlight_dom_leaks.md` — closed by PR #123
- `ideas/archive/bug_report_find_match_scrolls_to_wrong_line.md` — closed by PR #123
