# Settings: tone down recent-file typography

Status: proposed (tiny standalone PR). Noted while validating PR #166.

## Problem

In the Settings panel (the top-right settings surface, desktop
`WorkingModeBar` variant), each recent file renders with a **bold, large
filename** over a tiny path. The filename visually dominates the panel. As
Settings grows (the startup-tips toggle, and more later), recent files should
not be the loudest thing on open.

## Change

Tone down the recent-file filename so the list reads calmly: reduce its font
weight and size a notch. The path is fine small; nudge it only if needed for
balance. The goal is "visible, not in your face."

- Files: `src/components/WorkingModeBar.tsx` (desktop recent-files rendering) and
  `src/styles/global.css` (the recent-file name/path classes).
- No behavior change. Markup/CSS only.

## Acceptance

- Recent-file filename is no longer bold-and-large; the row reads as a quiet
  list item.
- Path remains legible.
- Existing `WorkingModeBar` tests still pass; no functional change.

## Scope

Tiny, standalone PR. Deliberately not bundled with the file-association feature
PR to keep that diff focused.
