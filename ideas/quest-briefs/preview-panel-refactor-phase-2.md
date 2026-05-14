# Quest Brief: PreviewPanel Refactor Phase 2 (AppShell Dedup)

Copy the block below (between the fences) into `/quest` to start the run.
The brief was written to be pasted verbatim; do not edit it unless you are
changing scope.

```
Quest brief: PreviewPanel Refactor Phase 2 (AppShell Dedup)

Context

- Source proposal: ideas/preview-panel-refactor.md. Phase 1 (mode split) is DONE; this quest is Phase 2 (App.tsx + DesktopApp.tsx dedup into a shared AppShell).
- Phase 1 quest journal: docs/journal/041-celebrate-preview-panel-refactor-phase-1.md. Read it to understand the test-first discipline and the size-ceiling enforcement pattern used there; the same shape applies here.
- Companion bug (open, do NOT fix in this quest): ideas/bug_report_find_preview_table_cells.md. PreviewPanel internals are off-limits; this quest only touches App-level chrome.
- Current sizes: src/App.tsx ~1306 lines, src/desktop/DesktopApp.tsx ~2911 lines. The proposal cited 756 and 2239 respectively; both grew by roughly 40 to 50 percent during the year, so the dup is getting worse, not better.

Goal

Collapse src/App.tsx and src/desktop/DesktopApp.tsx into a shared AppShell with two thin platform adapters, preserving 100% of current behavior in both shells. No bug fixes. No new features. No converter, save, Sparkle, licensing, or theme changes. PreviewPanel internals (everything under src/components/preview/) stay untouched.

Target shape (from the proposal):

  src/shell/
    AppShell.tsx              // shared layout, hero, view switcher, panels, resize handle
    useWorkspaceResize.ts     // page width + edit-shell height state + handlers
    desktopAdapter.tsx        // desktop-only: save state, conflict bar, native menu bridge
    webAdapter.tsx            // web-only: download save, theme persistence (web variant)

src/App.tsx becomes a thin shim that mounts AppShell with webAdapter. src/desktop/DesktopApp.tsx becomes a thin shim that mounts AppShell with desktopAdapter. PreviewPanel mounts inside AppShell exactly as it does today.

Required scope (test-first, ordered)

1. Characterization tests FIRST.
   - Audit existing Playwright coverage that exercises the shared chrome: tests/e2e/working-mode-chrome.spec.ts, tests/e2e/working-mode-collapse.spec.ts, tests/e2e/resize-handles.spec.ts, plus any tests that distinguish desktop vs. web behavior.
   - Identify behavior gaps. At minimum, add coverage for:
     a. Page-width and edit-shell-height resize geometry survives a single-shell round-trip (web variant).
     b. Same geometry round-trip in the desktop variant via the desktop renderer entry (when the desktop adapter is mounted).
     c. View switcher dynamic pill behavior is identical on both shells for the same source state.
     d. Hero + working-mode chrome auto-collapse-on-first-open is one-shot AND the auto-collapse does not re-fire after a manual expand (this is the regression PR #122 fixed; lock it).
     e. Drop-zone wiring works in both shells for the same files (web import path and desktop import path).
   - Commit characterization tests BEFORE any structural change. Run against pre-refactor main; if any fail, STOP and file a bug, do not fix in this quest.

2. Extract useWorkspaceResize.
   - File: src/shell/useWorkspaceResize.ts.
   - Wraps existing resize logic from BOTH App.tsx and DesktopApp.tsx, which is currently duplicated. Find the common math and surface a single hook with this contract: useWorkspaceResize({ minPageWidth, maxPageWidth, minEditShellHeight, persistKey? }) returns { pageWidth, editShellHeight, dragHandlers, ... } such that both shells consume it identically.
   - The persistKey parameter is optional. Desktop uses it for session restore (existing behavior); Web does not. The hook does the math; persistence is a separate concern handled by the adapter, not by the hook.
   - Constraints: byte-identical geometry vs. main. Existing resize-handles.spec.ts must pass unmodified.

3. Extract platform adapters.
   - src/shell/desktopAdapter.tsx: save state machine, conflict bar, native menu bridge, anything that talks to electron / native APIs. Adapter exports the slot props that AppShell consumes: { saveControls, statusPill, reloadAffordance, fileMenuSlot, conflictBarSlot, ... }.
   - src/shell/webAdapter.tsx: download-save, theme persistence (web variant), anything that uses browser-only APIs. Same slot prop contract.
   - The adapters do not know about each other. AppShell does not know which adapter is mounted; it takes slot props.

4. Extract AppShell.
   - src/shell/AppShell.tsx: shared layout JSX, hero, view switcher (DynamicPill), workspace panels mount, resize handle, drop-zone, install page entry. Receives slot props from the active adapter.
   - PreviewPanel mounts inside AppShell exactly as today; do not refactor PreviewPanelProps; do not add new props to PreviewPanel.

5. Thin App.tsx + DesktopApp.tsx wrappers.
   - src/App.tsx becomes a thin file that imports AppShell + webAdapter and mounts them together. Target: <=50 lines.
   - src/desktop/DesktopApp.tsx becomes the same thin pattern with desktopAdapter. Target: <=80 lines (desktop adapter has slightly more wiring but the file itself should be small).
   - Both files preserve their existing external import paths (other code imports App from src/App.tsx and DesktopApp from src/desktop/DesktopApp.tsx; these imports must keep working).

6. SRP/KISS/YAGNI sweep.
   - No platform feature flag inside AppShell. No runtime branching on "is this desktop?". Differences live in adapters.
   - No BaseAdapter class. No HOC. No context that erases the platform boundary.
   - No new dependencies. No new state libraries. No "future hooks" reserved for hypothetical third platforms.
   - Strong typing. Adapter slot contract is a TypeScript interface with concrete prop names, not a record of unknown.

Acceptance criteria

- AppShell <=400 lines, useWorkspaceResize <=200, each adapter <=400.
- src/App.tsx <=50, src/desktop/DesktopApp.tsx <=80 (thin wrappers).
- All existing Playwright + unit tests pass unmodified.
- New characterization tests pass against both pre- and post-refactor commits.
- src/components/preview/* untouched (Phase 1 territory). git diff main -- src/components/preview/ src/components/PreviewPanel.tsx must be empty (except possibly an import-path adjustment if AppShell now imports PreviewPanel from a different parent, which it should not need to).
- Mac manual validation: npm run build:mac && open .build/mac/Build/Products/Release/doc2md.app, then exercise all the chrome paths (open file, resize, mode switch, save/conflict, native menu, reload). No regressions.
- Web manual validation: npm run dev, open in a browser, exercise the same chrome paths. No regressions.
- Sanity: `wc -l src/App.tsx src/desktop/DesktopApp.tsx src/shell/*` shows the redistribution. Combined LOC across the four files should drop materially vs. the current `App.tsx + DesktopApp.tsx` total.

Validation

- npm ci (worktrees have separate node_modules)
- npm run lint && npm run typecheck && npm test && npm run test:e2e all green
- Mac manual + Web manual per acceptance criteria
- git diff main -- src/components/preview/ src/components/PreviewPanel.tsx empty
- grep -rn "from .*App$|from .*DesktopApp$|from .*\\./App|from .*\\./DesktopApp" src tests to confirm import paths preserved

Constraints

- Test-first. Characterization commits precede refactor commits.
- No PreviewPanel changes. Phase 1 is locked.
- No converter / save / Sparkle / licensing / theme changes.
- No new deps. No new state libraries.
- Honor AGENTS.md: KISS, DRY (not premature), YAGNI, SRP, strong typing.
- Worktree validation discipline: run `npm ci` FIRST after creating the worktree, before running any lint/typecheck/test. Worktrees have their own node_modules; failures in a stale worktree are not baseline rot.

Out of scope

- Phase 1 PreviewPanel work (already done).
- Open table-cell preview-find bug (separate quest).
- Theme system rework.
- Anything in src/converters/, src/save/, apps/macos/, or src/licensing/ (if such paths exist).
- Renaming App / DesktopApp at their existing import sites.
```

## When to run this

Run this quest after Phase 1 lands on `main` (PR for
`preview-panel-refactor-phase-1` quest). Phase 2 has no dependency on
fixing the open table-cell bug; the bug is intentionally out of scope.

## Where this came from

Extracted from `ideas/preview-panel-refactor.md` Section "Phase 2
(next)". The original proposal listed both phases together; Phase 1
landed first under quest
`preview-panel-refactor-phase-1_2026-05-13__2241`. The same test-first
discipline, line-ownership accounting, and YAGNI guardrails apply here.

Companion documents:
- `ideas/preview-panel-refactor.md` source proposal, updated with Phase 1 status.
- `docs/journal/041-celebrate-preview-panel-refactor-phase-1.md` what Phase 1 looked like in practice.
- `ideas/quest-briefs/preview-panel-refactor-phase-1.md` the Phase 1 brief, for reference shape.
