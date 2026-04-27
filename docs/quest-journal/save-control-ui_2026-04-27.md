# Quest: Mac Phase 6c — Explicit Save Control and Save State UI

- Quest ID: `save-control-ui_2026-04-27__1212`
- Completion date: 2026-04-27
- Mode: workflow
- Branch: `quest/save-control-ui`
- Outcome: complete

## Summary

Implemented Mac Phase 6c with a visible Save control, compact save-state UI, hosted-web download save behavior, and Mac native save behavior sharing the existing Cmd+S path. The quest also absorbed a pre-build scope change: fixing the Mac app build's "Browse from your device" file input by adding WKWebView open-panel support.

## What Changed

- Added `SaveButton` and `SaveStatePill` components with keyboard and screen-reader support.
- Wired hosted Save to the existing `downloadEntry` path, guarded by `isDownloadableEntry`.
- Wired Mac Save to the existing native `handleSave` path used by Cmd+S.
- Extended save-state handling so hosted web can show `Saved`, `Edited`, and `Saving` without exposing Mac-only conflict/error semantics.
- Added responsive toolbar styling for mobile widths.
- Implemented `WKUIDelegate.runOpenPanelWith` in the Mac shell so file input browsing works in the app build.
- Updated the Mac roadmap Phase 6a body block for PR #86.

## Validation

- `npm test -- --run` passed after fixes: 43 files / 361 tests.
- `npm run build` passed after fixes.
- `npm run build:desktop` passed after fixes.
- `bash scripts/build-mac-app.sh --configuration Release` passed after fixes.
- `scripts/verify-mac-release-launch.sh` was attempted and blocked because `doc2md` was already running; the script correctly refuses to kill a session it did not launch.
- `python3 scripts/security_ci_guard.py` was not run because workflows and scripts were not touched.

## Iterations

- Plan iterations: 2
- Fix iterations: 1
- Plan review: dual review plus arbiter, twice
- Code review: dual review, one fixer pass, clean dual re-review

## Files Changed

- `apps/macos/doc2md/WebShellView.swift`
- `ideas/mac-desktop-app-roadmap.md`
- `src/App.tsx`
- `src/__tests__/App.desktop.test.tsx`
- `src/__tests__/App.hosted.test.tsx`
- `src/components/PreviewPanel.tsx`
- `src/components/SaveButton.tsx`
- `src/components/SaveStatePill.tsx`
- `src/components/__tests__/DropZone.test.tsx`
- `src/components/__tests__/SaveButton.test.tsx`
- `src/components/__tests__/SaveStatePill.test.tsx`
- `src/desktop/__tests__/saveState.test.ts`
- `src/desktop/useDesktopSaveState.ts`
- `src/styles/global.css`

## Review Outcome

Initial code review found a hosted Save semantics regression: empty scratch drafts could appear saveable because the button was keyed too broadly. The fixer tightened hosted Save to reuse `isDownloadableEntry` for both the click handler and disabled state, added an empty-scratch regression test, and the re-review passed cleanly.

## Celebration Data

<!-- celebration-data-start -->
```json
{
  "quest_mode": "workflow",
  "agents": [
    {"name": "planner", "model": "claude-opus", "role": "Plan Architect"},
    {"name": "plan-reviewer-a", "model": "claude-opus", "role": "A Plan Critic"},
    {"name": "plan-reviewer-b", "model": "gpt-5.4", "role": "B Plan Critic"},
    {"name": "arbiter", "model": "claude-opus", "role": "Plan Gatekeeper"},
    {"name": "builder", "model": "gpt-5.4", "role": "Implementation Builder"},
    {"name": "code-reviewer-a", "model": "claude-opus", "role": "A Code Critic"},
    {"name": "code-reviewer-b", "model": "gpt-5.4", "role": "B Code Critic"},
    {"name": "fixer", "model": "gpt-5.4", "role": "Regression Fixer"}
  ],
  "achievements": [
    {"icon": "💾", "title": "Visible Save", "desc": "Save moved from shortcut knowledge to a compact toolbar control."},
    {"icon": "🖥️", "title": "Native Path Preserved", "desc": "Mac Save button and Cmd+S share the same native save code path."},
    {"icon": "🌐", "title": "Hosted Path Preserved", "desc": "Hosted web Save stays on the existing download/export path."},
    {"icon": "📂", "title": "Browse Revived", "desc": "WKWebView file input browsing works through an open panel in the app build."},
    {"icon": "🧪", "title": "Regression Caught", "desc": "Review caught and fixer resolved the hosted empty-scratch save regression."}
  ],
  "metrics": [
    {"icon": "🧪", "label": "361 tests passing"},
    {"icon": "🏗️", "label": "Hosted, desktop bundle, and Release Mac builds passed"},
    {"icon": "🔁", "label": "2 plan iterations, 1 fix iteration"},
    {"icon": "🧭", "label": "100% structured handoff compliance"}
  ],
  "quality": {"tier": "Gold", "icon": "🥇", "grade": "B"},
  "quote": {
    "text": "Hosted Save now reuses the downloadable-entry guard and has an empty-scratch regression test.",
    "attribution": "Fixer handoff"
  },
  "victory_narrative": "Phase 6c shipped the visible save affordance without inventing a new save system, then handled a Mac file-picker bug as a narrow shell fix. The review loop did its job: it caught a hosted semantics regression before it escaped.",
  "test_count": 361,
  "tests_added": 8,
  "files_changed": 14
}
```
<!-- celebration-data-end -->
