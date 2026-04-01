# Quest Journal: LinkedIn Unicode Preview

**Quest ID:** `linkedin-unicode-preview_2026-03-31__2103`
**Date:** 2026-03-31
**Mode:** solo
**Outcome:** Complete

## Summary

Added a new LinkedIn-oriented preview mode that shows supported Markdown as deterministic Unicode/plain text without disturbing the normal editor or rendered Markdown preview.

The implementation stayed bounded in the way the user asked:

1. added a third preview toggle for LinkedIn-style formatting
2. kept the feature preview-only, not a download/export path
3. refused to render unsupported constructs such as Markdown tables and HTML tags instead of mixing partial output
4. fixed the one review finding so the LinkedIn formatter only runs when the user explicitly selects that mode

## Files Changed

| File | Change |
|------|--------|
| `src/components/PreviewPanel.tsx` | Added the LinkedIn mode toggle, isolated LinkedIn-mode rendering, and guarded LinkedIn processing behind the active mode |
| `src/components/PreviewPanel.test.tsx` | Added toggle, refusal, mode-roundtrip, and accessibility coverage for the new preview mode |
| `src/components/linkedinFormatting.ts` | Added refusal detection and deterministic LinkedIn/plain-text formatting helpers |
| `src/components/linkedinFormatting.test.ts` | Added unit coverage for supported formatting, refusal cases, and code/pipe edge cases |
| `src/styles/global.css` | Added LinkedIn preview and refusal styling, including dark-theme treatment |
| `docs/dexter-journal/009-requiem-linkedin-unicode-preview.md` | Saved the quest requiem |
| `docs/dexter-journal/README.md` | Indexed the new Dexter journal entry |

## Iterations

- Plan iterations: 1
- Fix iterations: 1
- Code review rounds: 2

## Review Notes

- Plan review approved the scoped third-mode approach on the first pass.
- First code review approved with one should-fix: the LinkedIn detector/formatter was running on every render instead of only in LinkedIn mode.
- The fix loop addressed that by guarding both LinkedIn computations behind `mode === "linkedin"`.
- Final review passed cleanly with no blockers, no must-fix items, and no remaining should-fix items.

## Validation

- `npx vitest run src/components/linkedinFormatting.test.ts src/components/PreviewPanel.test.tsx src/App.test.tsx` → 35 tests passing
- `npx vitest run` → 28 files, 202 tests passing

## This Is Where It All Began

> Implement a way to view Unicode characters, framed as "LinkedIn formatting", in the preview area to the right of the existing Preview toggle.

That survived intact. The main correction was not about scope but about isolation: the LinkedIn path had to remain opt-in so a bug there could not poison the normal edit or preview experience.

## Celebration Data

<!-- celebration-data-start -->
```json
{
  "quest_mode": "solo",
  "agents": [
    {"name": "planner", "model": "claude-opus-4-6", "role": "Planner"},
    {"name": "plan-reviewer-a", "model": "claude-opus-4-6", "role": "Plan Reviewer A"},
    {"name": "builder", "model": "gpt-5.4", "role": "Builder"},
    {"name": "code-reviewer-a", "model": "claude-opus-4-6", "role": "Code Reviewer A"},
    {"name": "fixer", "model": "gpt-5.4", "role": "Fixer"}
  ],
  "achievements": [
    {"icon": "🧭", "title": "Boundary Kept", "desc": "LinkedIn formatting stayed a preview-only branch rather than turning into export scope or preview-pipeline drift."},
    {"icon": "🚫", "title": "Refusal Over Fiction", "desc": "Unsupported tables and HTML are rejected instead of rendered badly."},
    {"icon": "🧪", "title": "Late Render Guard", "desc": "The one review issue was fixed by ensuring LinkedIn parsing only runs when the LinkedIn mode is active."}
  ],
  "metrics": [
    {"icon": "🧪", "label": "202/202 tests passing"},
    {"icon": "🪵", "label": "5/5 handoff entries via handoff.json"},
    {"icon": "🔁", "label": "1 plan iteration, 1 fix iteration"}
  ],
  "quality": {"tier": "Platinum", "icon": "🏆", "grade": "A"},
  "quote": {"text": "Clean implementation, all tests pass, no blockers or fixes needed. Approved.", "attribution": "Code Reviewer A"},
  "victory_narrative": "The feature shipped without contaminating the default edit and preview flow. The optional branch stayed optional.",
  "test_count": 202,
  "tests_added": 12,
  "files_changed": 7
}
```
<!-- celebration-data-end -->
