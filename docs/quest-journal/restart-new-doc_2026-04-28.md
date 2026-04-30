# Quest: Restart New Document

- Quest ID: `restart-new-doc_2026-04-28__2028`
- Completion date: 2026-04-28
- Mode: solo
- Branch: `quest/restart-new-doc`
- Outcome: complete

## Summary

Made "start a new document" a repeatable, dirty-safe action across the doc2md app. Before this quest, the New flow only fired from the empty initial state; once any draft or file existed, the user had no path back to a clean blank document. After: Cmd+N on Mac, the empty-state Start writing CTA, and a new persistent hosted toolbar New button all route through one shared `handleNewDocument()` reset path that prompts before discarding any unsaved state, including conflict and error states.

## What Changed

- New atomic helper `replaceWithScratchEntry()` in `useFileConversion()` that does one `setEntries(() => [createScratchEntry()])` update. No back-to-back state composition.
- New shared `handleNewDocument()` in `App.tsx` performing exactly: replace entry, clear desktop problem, reset save state, switch to Convert, bump editor focus token.
- Dirty rule is `saveState.state !== "saved"`, which captures `edited`, `saving`, `conflict`, `error`, and `permission-needed`. `window.confirm` blocks accidental discard; cancel preserves entry, edits, save state, conflict UI, and `desktopFile` binding.
- Hosted save-state dispatcher now accepts the `reset` event so browser drafts can return to `Saved` after an accepted New.
- Persistent hosted New toolbar button in `PreviewPanel` populated state, ungated by `isDesktop`, lucide-react `FilePlus`, label `New`, `aria-label="New document"`, ghost-button styling.
- Editor focus reuses the existing `findFocusRequest {id, target}` pattern; an effect in `PreviewPanel` watches `editorFocusRequest.id`, switches mode to `edit`, and focuses the textarea after the scratch entry renders.
- A separate cleanup commit on the same branch reverted an unrelated rollback of the Phase 6d find/replace status entries in `ideas/mac-desktop-app-roadmap.md` that the builder accidentally introduced.

## Validation

- `npm run typecheck` — passed
- `npm run lint` — passed
- `npm test` — full suite passed; targeted tests covered hook unit, populated New button, focus, hosted dirty cancel/accept, desktop saved/dirty/conflict cancel/accept, and `desktopFile === undefined` plus `Save -> Save As` regression.
- `npm run build` — passed
- `npm run build:mac` — passed (Release `.app` produced)

Manual Mac validation (the user's standard flow: `npm run build:mac` then `open .build/mac/Build/Products/Release/doc2md.app` and File > Open) is listed in the PR description checklist for the user to run on their machine before merge.

## Iterations

- Plan iterations: 2
- Fix iterations: 0
- Plan review: solo (single Reviewer A). Iteration 1 approved with one required change (persistent hosted New button) plus four should-fixes. Iteration 2 folded all of them in and got a clean approve.
- Code review: solo (single Reviewer A). Clean approve. Two info-severity non-blocking notes were deferred to `.quest/backlog/deferred_findings.jsonl`.

## Files Changed

- `src/App.tsx`
- `src/__tests__/App.desktop.test.tsx`
- `src/__tests__/App.hosted.test.tsx`
- `src/components/PreviewPanel.test.tsx`
- `src/components/PreviewPanel.tsx`
- `src/desktop/__tests__/saveState.test.ts`
- `src/desktop/useDesktopSaveState.ts`
- `src/hooks/useFileConversion.test.ts`
- `src/hooks/useFileConversion.ts`

## Review Outcome

Code review found no blockers. Two info-severity notes were captured and deferred:

1. `addScratchEntry()` may be dead application code now that the new shared replace path is wired up; tests still exercise it. Deferred for a future cleanup pass.
2. `nativeMenuHandlers.onCloseWindow` reuses `saveState.reset`, which means closing the window from a dirty state silently resets save state without a confirm. Pre-existing behavior, explicitly out of scope for this quest's window-lifecycle clause; deferred for a future Mac UX pass.

Both items are tracked in `.quest/backlog/deferred_findings.jsonl` with lineage to this quest.

A separate finding from the orchestrator: the builder accidentally regressed two lines in `ideas/mac-desktop-app-roadmap.md` (Phase 6d find/replace done-status entries). That was caught pre-review and reverted in a follow-up commit on the same branch.

## Celebration Data

<!-- celebration-data-start -->
```json
{
  "quest_mode": "solo",
  "agents": [
    {"name": "planner", "model": "gpt-5", "role": "Plan Architect"},
    {"name": "plan-reviewer-a", "model": "claude-opus-4-7", "role": "Solo Plan Critic"},
    {"name": "builder", "model": "gpt-5", "role": "Implementation Builder"},
    {"name": "code-reviewer-a", "model": "claude-opus-4-7", "role": "Solo Code Critic"}
  ],
  "achievements": [
    {"icon": "🆕", "title": "Always New", "desc": "Cmd+N, empty-state CTA, and a new toolbar button all route through one shared reset."},
    {"icon": "🛡️", "title": "Dirty-Safe", "desc": "Discard prompt covers edited, saving, conflict, error, and permission-needed states."},
    {"icon": "🎯", "title": "Atomic Reset", "desc": "One setEntries call replaces the session with a single clean scratch — no back-to-back state races."},
    {"icon": "🔍", "title": "Reviewer Caught Discoverability", "desc": "Plan iter 1 missed a persistent hosted New surface; iter 2 folded the required button in before build."},
    {"icon": "🧹", "title": "Roadmap Restored", "desc": "Caught and reverted an unrelated builder rollback to the Phase 6d status entries."}
  ],
  "metrics": [
    {"icon": "🧪", "label": "Full npm test suite passes"},
    {"icon": "🏗️", "label": "Hosted build and Mac Release .app build pass"},
    {"icon": "🔁", "label": "2 plan iterations, 0 fix iterations"},
    {"icon": "📦", "label": "9 files changed, +468 / -11"}
  ],
  "quality": {"tier": "Gold", "icon": "🥇", "grade": "B"},
  "quote": {
    "text": "Iteration 2 plan addresses all carry-forward items (required hosted button, conflict-aware dirty semantics, ordered reset, atomic helper, focus pattern reuse, nits). APPROVE.",
    "attribution": "Plan Reviewer A handoff"
  },
  "victory_narrative": "A small UX gap with a clean fix: one shared reset path, one dirty rule, one atomic replace. The plan loop earned its keep when iteration 1's reviewer flagged that the hosted build had no persistent New affordance once the empty-state CTA disappeared. Iteration 2 folded the toolbar button in and the build came out clean.",
  "test_count": null,
  "tests_added": 9,
  "files_changed": 9
}
```
<!-- celebration-data-end -->
