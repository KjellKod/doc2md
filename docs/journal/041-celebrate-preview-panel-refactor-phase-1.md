# 041 — PreviewPanel Refactor, Phase 1

A year ago the proposal said: split the 1038-line `PreviewPanel.tsx` into a shell plus mode components, because three find/anchor bugs had already clustered at that seam. We didn't. The file grew to 1285 lines and the seam grew with it.

This quest unwound that. Same proposal, same shape, executed test-first across seven commits, with an eighth follow-up from the fix loop.

## What landed

Eight commits on `worktree-preview-panel-refactor`:

- `14c8e0f` characterization tests (the four required cases: active-mode `<mark>` cleanliness, soft-wrap anchor across mode switch, ghost-highlight after edit typing, Cmd+F query preservation)
- `4c8ea40` `useViewportAnchor` hook (thin wrapper over `viewportAnchor.ts`)
- `1e26e5c` `useFindHighlight` hook (`useMemo` wrapper that stabilizes the rehype plugin reference — short, but earns its keep against `previewRehypePlugins` churn)
- `4d7b84f` `EditMode.tsx` (textarea + overlay + `renderFindHighlight` + IME + formatting shortcuts)
- `81294a1` `PreviewMode.tsx` + `LinkedInMode.tsx` (rendered surfaces, segmentation, refusal interlude)
- `5ae5518` shell move + flat extractions (`PreviewToolbar.tsx`, `PreviewEmptyStates.tsx`, `previewCopy.ts`) — and the deletion of the old shell-side combined `useLayoutEffect` at the historical `PreviewPanel.tsx:625-657`
- `80f4ad1` post-React-19 ref-type cleanup
- `14731eb` (fix loop) hoist `viewportTopFloor` above first use

Result: shell at exactly 350 lines (= ceiling), EditMode 373, LinkedInMode 325, PreviewMode 170, hooks 79 and 9. `PreviewPanelProps` byte-compatible. `src/App.tsx` and `src/desktop/DesktopApp.tsx` empty diff against `main`. Import path `from "./components/PreviewPanel"` still resolves via the two-line compat shim.

## What didn't land (by design)

- The open table-cell preview-find bug (`ideas/bug_report_find_preview_table_cells.md`). Failure shape unchanged, verified post-refactor — but the rendered corpus computation now lives in `PreviewMode.tsx` alone, so the future fix is local.
- Phase 2 (`AppShell` dedup of the 1306-line `App.tsx` and 2911-line `DesktopApp.tsx`). Separate quest.
- The pre-existing baseline rot: `react-hooks/set-state-in-effect` rule references in `DesktopApp.tsx` (PR #120 fallout), `read-excel-file` v9 typing in `office.ts`, a handful of test files drifted. All exist on `main` and are entirely outside the refactor diff. Reviewers and I confirmed both — flagged as a separate merge-readiness concern, not this quest's responsibility.

## The shape of the work

Iteration 1 of the plan was too optimistic: planner estimated 280–340 lines for the shell; both reviewers independently inventoried the actual shell-owned blocks against current line ranges in `PreviewPanel.tsx` and projected 400–565. They also caught two gaps in the anchor-handoff spec — the shell-side combined `useLayoutEffect` deletion wasn't called out, and the "clear pending state" step was unconditional (would have broken the LinkedIn refusal-interlude invariant covered by `tests/e2e/view-anchor-mode-switch.spec.ts:359-411`).

The arbiter cut through to two surgical fixes plus six builder notes. Iteration 2 came back with a line-ownership table citing real ranges, three concrete flat extractions named up-front, `applyAnchorLine(line) === true` gating for pending-state clearing, and an explicit "delete shell-side effect in commit 6" step. Same scope, sharpened. Approved.

Builder reported `STATUS: blocked` because the full validation gate fails on baseline rot. That's the right call — fenced files were correctly untouched, and the refactor surface itself passed. The reviewers reproduced the baseline failures on `main`, decoupled them from the refactor verdict, and approved with two low-severity nits. The fix loop closed one (function declaration hoist for readability), deferred the other (ref-type duplication — deliberate per the React-19 typing pass in commit 80f4ad1).

Two clean reviewer rounds, no contested findings, structured-handoff compliance 14/14.

## Why it matters

The proposal's load-bearing observation was that recent find/anchor bugs all live at this seam, and the next one would too. The refactor doesn't fix bugs — that wasn't its job — but it gives the next fix a 350-line shell to land in instead of a 1285-line component. The LinkedIn refusal-interlude invariant, the soft-wrap anchor handoff, the active-match centering suppression flag, the `FindReplaceBar` mount stability across mode switches — all of these now have a single colocated home and a characterized contract.

The table-cell bug will be the next test case. The rendered corpus computation that used to be entangled with eight other concerns now lives in one mode file with a known failure shape and a planned narrow fix. That's the dividend.

## Calm refactor energy

Codex Reviewer A signed off on the fix commit with a one-liner I keep coming back to: "the function packed its bag, walked 30 lines uphill, unpacked the same body." That's what behavior-preserving structural surgery should feel like. No new abstractions, no clever moves, no future-proofing. Just the proposal, written down a year ago, finally executed.

— Jean-Claude
