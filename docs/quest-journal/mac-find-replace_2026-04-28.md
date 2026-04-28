# Mac Find Replace

- **Quest ID:** `mac-find-replace_2026-04-28__0032`
- **Completion date:** 2026-04-28
- **Mode:** workflow
- **Plan iterations:** 2
- **Fix iterations:** 1
- **Outcome:** Complete

## Summary

Added compact Find / Replace support to the shared Markdown editor for hosted web and the Mac app. The implementation adds a visible editor entry point, Cmd/Ctrl+F and replace shortcuts, literal and regex matching, case-sensitive search, active-match selection, next/previous navigation, replace current/all, compact count/error states, responsive toolbar styling, and accessibility labels/status announcements.

The feature stays inside the shared React editor path and routes edits through the existing `onMarkdownChange` flow so dirty tracking and Save behavior remain unchanged.

As a final polish, the Mac build helper now rewrites Xcode's final success banner to include the resolved display version, for example `** 2.0.3-dev BUILD SUCCEEDED **`.

## Files Changed

- `src/components/FindReplaceBar.tsx`
- `src/components/useFindReplace.ts`
- `src/components/PreviewPanel.tsx`
- `src/styles/global.css`
- `src/components/__tests__/FindReplaceBar.test.tsx`
- `src/components/__tests__/useFindReplace.test.ts`
- `src/components/PreviewPanel.test.tsx`
- `scripts/build-mac-app.sh`

## Validation

- `npm test -- --run` passed.
- `npm run lint` passed.
- `npm run build` passed.
- `npm run build:desktop` passed.
- `bash scripts/build-mac-app.sh --configuration Release` passed and printed `** 2.0.3-dev BUILD SUCCEEDED **`.
- `scripts/verify-mac-release-launch.sh` was skipped because an existing doc2md app process was running and the verifier would refuse to avoid killing that session.
- `python3 scripts/security_ci_guard.py` passed after the build helper change.

## Review Outcome

The first code review found shortcut focus and scroll behavior issues. The fixer resolved the repeated shortcut focus regression, stabilized selection scroll updates, and added regression coverage for repeated shortcuts, non-capable editor states, replace-all cap bypass, replace status announcement, and LinkedIn mode close behavior.

Final dual code review passed:

- Claude reviewer: "Fix iteration 1 cleanly resolves all prior findings; tests, lint, and integration paths all hold."
- Codex reviewer: "Reviewed fix iteration 1; prior shortcut focus blocker is fixed and no new blocking regressions were found."

## Celebration Data

<!-- celebration-data-start -->
```json
{
  "quest_mode": "workflow",
  "agents": [
    {"name": "Planner", "model": "Claude Opus 4.7", "role": "Plan author"},
    {"name": "Plan Reviewer A", "model": "Claude Opus 4.7", "role": "A Plan Critic"},
    {"name": "Plan Reviewer B", "model": "Codex", "role": "B Plan Critic"},
    {"name": "Arbiter", "model": "Claude Opus 4.7", "role": "Plan Arbiter"},
    {"name": "Builder", "model": "Codex", "role": "Implementation"},
    {"name": "Code Reviewer A", "model": "Claude Opus 4.7", "role": "A Code Critic"},
    {"name": "Code Reviewer B", "model": "Codex", "role": "B Code Critic"},
    {"name": "Fixer", "model": "Codex", "role": "Fix loop"}
  ],
  "achievements": [
    {"icon": "🔎", "title": "Editor Search Landed", "desc": "Find and Replace now works inside the Markdown editor instead of relying on browser page find."},
    {"icon": "⌨️", "title": "Shortcut Discipline", "desc": "Cmd/Ctrl+F and replace shortcuts are scoped to edit-capable Markdown surfaces."},
    {"icon": "🧪", "title": "Regex Contract Settled", "desc": "Invalid regex is safe, zero-width regexes are bounded, and Replace All bypasses navigation caps."},
    {"icon": "🔧", "title": "One Fix Loop", "desc": "Shortcut focus and scroll issues were caught in review and resolved in a single fix iteration."}
  ],
  "metrics": [
    {"icon": "📄", "label": "Shared React UI covers hosted web and Mac WebView"},
    {"icon": "🧭", "label": "2 plan iterations, 1 fix iteration"},
    {"icon": "✅", "label": "14/14 structured handoffs parsed from handoff.json"},
    {"icon": "🧪", "label": "Tests, lint, web build, desktop build, and Mac Release build passed"}
  ],
  "quality": {"tier": "Gold", "icon": "🥇", "grade": "B"},
  "quote": {
    "text": "Fix iteration 1 cleanly resolves all prior findings; tests, lint, and integration paths all hold.",
    "attribution": "Code Reviewer A"
  },
  "victory_narrative": "The editor gained focused Find / Replace without replacing the editor, changing save semantics, or dragging native Mac code into a shared React problem.",
  "test_count": 383,
  "tests_added": 0,
  "files_changed": 7
}
```
<!-- celebration-data-end -->
