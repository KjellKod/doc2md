---
title: Focused doc2md UX refinements
status: Complete
completed: 2026-10-09
---

# Focused doc2md UX refinements

The user chose code-first refinement of the mature web and Mac product, then approved three changes: protect unsaved drafts, enter the working layout when writing starts, and clarify browser output. LinkedIn placement, broader toolbar reorganization, and introductory-copy changes were excluded. See the [continuing handoff](../impeccable-ux-handoff.md) and [product context](../../../PRODUCT.md).

## Delivered behavior

- Clear confirms before discarding edited documents or pending output. Cancel preserves content and selection; untouched drafts and clean documents avoid unnecessary prompts.
- Start writing/New opens the existing working layout immediately. The logo restores the introduction while keeping documents open.
- Browser output has one primary Markdown download control, separate HTML export, and accurate download-request feedback. Output state belongs to each document and preserves edits made while a download is pending.
- Mac Save/Save As retains native persistence. A save race found during review was fixed: newer edits remain unsaved after success or cancellation, including when the active document changes. Successful saves retain destination metadata for subsequent saves.
- Compact output uses readable 14px labels, preserves toolbar geometry at 320px, and avoids growing after output status changes. Native Save and LinkedIn placement remain intact.
- README documents the workflow and output distinction.

## Verification

Reproduce-first integration tests cover destructive Clear, workspace entry, per-document output, and native save success/cancellation races. The unchanged failing regressions passed after their fixes. Independent final source review found no remaining actionable P1/P2 issue in this scope.

- Typecheck passed.
- ESLint passed with zero errors and five existing warnings (three redundant suppressions, two Fast Refresh export warnings).
- Web production build and desktop web bundle build passed, with the existing large-chunk warning.
- Expanded Playwright run: **106 passed, 7 skipped, 7 failed** across desktop Chromium, mobile Chromium, and mobile Safari. All new focused workflow tests and applicable mobile layout checks passed. Failures are documented below; the expanded suite is not fully green.
- Full unit/integration suite: **973 passed in 82 files** on the isolated rerun.
- Desktop and mobile Safari screenshots were inspected. Native Mac GUI/installed DMG was not exercised; React/bridge coverage and a desktop bundle build are not a native runtime smoke test.

### Existing browser test failures

Six failures are in `working-mode-collapse.spec.ts`, lines 21, 38, and 106, on both mobile projects. They assume desktop collapse controls/tooltips on mobile. Unchanged HEAD CSS hides `.collapse-toggle` below 980px, and the mobile Uploads button has no desktop rail tooltip relationship. Dedicated mobile upload-toggle/layout tests passed. These existing tests were not weakened or skipped to hide failures.

One failure is `hosted-browser-baseline.spec.ts:414` on mobile Safari: bulk download expects two files but observes only `gamma.md`. This exact failure was reproduced from a clean archive of unchanged HEAD **e8d4f21**, served separately on port 4174. It predates this change and remains an open compatibility limitation. Baseline server was stopped and temporary checkout removed; reproduction output was `/tmp/doc2md-head-bulk`.

### Test environment

Unit tests require `NODE_OPTIONS=--no-experimental-webstorage` in this environment so the Node global does not interfere with jsdom storage. `PATH="/opt/homebrew/bin:$PATH"` selects Homebrew Git for the notice-inventory fixture that deliberately sets an invalid developer directory. The initial full run alongside browser/build work had 972 passes and a 5-second timeout in the existing 5000-line gutter test; the isolated rerun passed all 973 tests with `--maxWorkers=2`, without changing assertions or timeouts.

## Delivery state

All implementation, tests, product context, and Impeccable artifacts are local and uncommitted on `chore/impeccable-init`. No commit, push, PR, or release was requested or performed. The archived critique remains a historical snapshot; its toolbar and copy recommendations are still deferred. No broad visual redesign was attempted.
