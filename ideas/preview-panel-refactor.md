# PreviewPanel Refactor: Split Modes + Dedup App Shells

## Status

- **Phase 1: DONE.** Landed in PR (link TBD when merged) via quest
  `preview-panel-refactor-phase-1_2026-05-13__2241`. Journal:
  `docs/journal/041-celebrate-preview-panel-refactor-phase-1.md`.
- **Phase 2: NOT STARTED.** Quest brief at
  `ideas/quest-briefs/preview-panel-refactor-phase-2.md`. Run when ready.

## Why

`src/components/PreviewPanel.tsx` was 1038 lines at the time of the original
proposal and had grown to 1285 lines a year later. It owned nine distinct
concerns: view-mode state, find bar wiring, DOM-mutation highlighting (since
removed by PR #123), viewport anchor capture/apply, LinkedIn segmentation,
copy-to-clipboard, Cmd+F interception, source-line metadata, and find-overlay
scroll sync. Every find or anchor bug ended up forcing a change inside this one
component, against three view modes plus find-on/find-off plus
edit-mode/preview-mode/linkedin-mode. The blast radius per change was too
large.

`src/desktop/DesktopApp.tsx` (2911 lines at the time of the Phase 1 quest) and
`src/App.tsx` (1306 lines) are a copy-paste pair. They share: page-width state,
edit-shell-height state, drag-handle handlers, view-switcher + dynamic pill,
hero copy, preview-panel wiring, drop-zone wiring, install page. Every desktop
fix lands twice.

These structural choices were the load-bearing reason recent bugs
(rendered-surface find leaks, find-match drift, edit-leaks-into-preview)
kept recurring near the find / mode-switch seam. Phase 1 fixed the
PreviewPanel half. Phase 2 needs to fix the App-shell half.

## Phase 1 (done)

`src/components/PreviewPanel.tsx` split into a thin shell plus three mode
components and two hooks:

```
src/components/preview/
  PreviewPanel.tsx          // thin shell: mode switcher + toolbar + body slot
  EditMode.tsx              // textarea + mirror + edit-mode anchor wiring
  PreviewMode.tsx           // markdown-surface + rehype + preview-mode anchor wiring
  LinkedInMode.tsx          // per-line spans + linkedin-mode anchor wiring
  PreviewToolbar.tsx        // flat colocated toolbar JSX
  PreviewEmptyStates.tsx    // flat colocated empty/pending/error branches
  previewCopy.ts            // flat helpers for plain and rich copy
  useViewportAnchor.ts      // capture/apply hook (wraps viewportAnchor.ts helpers)
  useFindHighlight.tsx      // stabilizes rehype plugin reference (byte-identical output)
```

Final sizes (all under ceilings):

| File                              | Lines | Ceiling |
| --------------------------------- | ----: | ------: |
| `preview/PreviewPanel.tsx`        |   350 |     350 |
| `preview/EditMode.tsx`            |   373 |     500 |
| `preview/LinkedInMode.tsx`        |   325 |     500 |
| `preview/PreviewMode.tsx`         |   170 |     500 |
| `preview/useViewportAnchor.ts`    |    79 |     200 |
| `preview/useFindHighlight.tsx`    |     9 |     200 |
| `preview/PreviewToolbar.tsx`      |   167 |   (n/a) |
| `preview/PreviewEmptyStates.tsx`  |   102 |   (n/a) |
| `preview/previewCopy.ts`          |    57 |   (n/a) |
| `components/PreviewPanel.tsx`     |     2 |   (n/a) |

`PreviewPanelProps` unchanged. `git diff main -- src/App.tsx
src/desktop/DesktopApp.tsx` empty. Import path preserved via the 2-line
compat shim at `src/components/PreviewPanel.tsx`. Characterization tests
landed in commit 1 and passed against pre-refactor `main`.

## Phase 2 (next)

Collapse `App.tsx` and `DesktopApp.tsx` into a shared `AppShell` with two
thin platform adapters:

```
src/shell/
  AppShell.tsx              // shared layout, hero, view switcher, panels, resize handle
  useWorkspaceResize.ts     // page width + edit-shell height state + handlers
  desktopAdapter.tsx        // desktop-only: save state, conflict bar, native menu bridge
  webAdapter.tsx            // web-only: download save, theme persistence (web variant)
```

`AppShell` takes platform-specific slots (save controls, status pill,
reload affordance) from whichever adapter mounts it. The 99% copy-paste
across the two top-level components disappears.

**Current sizes (as of 2026-05-13):**

- `src/App.tsx`: 1306 lines (was 756 in the original proposal)
- `src/desktop/DesktopApp.tsx`: 2911 lines (was 2239 in the original proposal)

Both grew by roughly 40 to 50 percent during the year. The dup is real
and getting worse; every desktop chrome fix has to land twice.

## Risk

Phase 1 risk was contained by test-first ordering and a load-bearing
proposal that turned out to be exactly right. Phase 2 risk profile:

- **Dedup has the most surface area but the lowest per-change risk**
  because the underlying logic is already proven; this is purely
  deduplication.
- **Platform adapter boundary** is the new design surface. The risk is
  that an over-eager AppShell tries to model "platform" as a generic
  abstraction. The right shape is two adapters that own platform-specific
  slots, not a runtime platform feature flag inside AppShell.
- **State ownership** for the resize hook and the view switcher needs to
  match the existing Web/Desktop semantics. Desktop has session restore
  for resize geometry, Web does not; the hook should own resize math, not
  persistence.

## When

Run after Phase 1 lands and stabilizes. The Phase 2 quest brief at
`ideas/quest-briefs/preview-panel-refactor-phase-2.md` is the entry point.

## Adjacent gaps the find subsystem extraction should fix

From the `doc2md-ux-hardening-proposal` archive validation (see `docs/ideas-audit-2026-05-14.md` appendix), two sub-claims that live inside `useFindReplace` should be addressed by this refactor:

- **Incremental, cancellable search**. Current code recomputes whole-document matches via `useMemo` on every `[source, query, options]` change with no AbortController and no streaming. The 5,000-match cap is enforced, but a long query against a long document still does the work synchronously. The find-subsystem split should introduce cancellation on input change and chunked tokenization.
- **Replace All as a single undo step**. The proposal called this non-negotiable; current history-coalescing behavior is unverified. Confirm or add coalescing when extracting the replace path.

These are not blocking. They tag along with the seam the refactor already opens. Phase 1 did not address them (the hook split was structural only); fold them into the Phase 2 quest brief or a separate find-subsystem-polish quest.

## Out of scope (for both phases)

- Rewriting in another language. The bugs were not language-caused; the
  Phase 1 results confirm that.
- Changing the converter pipeline, save semantics, Sparkle/notarization
  plumbing, or licensing boundary.
- Theme system changes.
- Re-opening the table-cell preview-find bug. It shipped in PR #128
  (`ideas/archive/bug_report_find_preview_table_cells.md`) as a
  follow-up to Phase 1; the fix was a 72-line shared helper plus a
  hast offset rule, made small precisely because Phase 1 colocated
  the rendered corpus computation in `PreviewMode.tsx`.
