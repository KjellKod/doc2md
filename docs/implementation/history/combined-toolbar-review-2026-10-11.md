# Combined toolbar: final review and validation

Approved scope: B combined toolbar and the prior focused Clear/New/download/save-race refinements, in the shared web/Mac application. No conversion rewrite, release publishing, or new onboarding.

## Self-review

Checked typed web/native boundaries, single ownership of editor state, conversion/source metadata, native no-overwrite rename and stale-mtime validation, save races, dirty-document protection, keyboard/focus behavior, responsive layouts and settings. Regression tests cover the actual failure paths.

Additional fixes from validation: keep an unavailable output icon with no open document; keep the toolbar visible when keyboard focus scrolls a short viewport; return browser Find to the browser while Install & Use hides the document. Existing sidebar width animation remains untouched under the user's explicit instruction. No new detector suppression was added in this pass.

## Independent Claude review

Claude Code identified itself as Claude Opus 5.5 (`claude-opus-5-5`). It reviewed all production changes against the approved scope and ran 50 focused tests. It reported no blockers or must-fix items, five should-fix items and three low-severity findings. A subsequent Codex review checked the changes below and found no consequential remaining issue.

| Finding | Disposition |
| --- | --- |
| Imported output rename overwrote source format/File | Fixed: separate `renameOutput` retains source File, format, quality, warnings and content; native Save/Save As ownership conversion remains separate. |
| Disabled output explanation inaccessible | Fixed: focusable, named group with linked tooltip description around the native disabled button; icon buttons also link descriptions. |
| Accessible title omitted filename | Fixed: accessible name includes the visible filename. |
| Failed rename lost keyboard focus | Fixed: restore input focus after busy state clears; regression assertion added. |
| Web shortcut help advertised nonexistent Save shortcut | Fixed: only advertise the host-provided shortcut. |
| Case-only native rename allegedly failed | Not reproduced: real APFS operation succeeded; added native regression, no speculative production workaround. |
| Rename library bookkeeping depended on current license/origin | Fixed: relocate an existing library row independently of current entitlement, retain timestamp, do not enroll unrecorded documents. |
| Document commands remained live on Install & Use | Fixed: hide document commands/title/actions outside workspace; preserve editor and settings. |

Claude's review was source-based for accessibility; it did not claim a VoiceOver run. Native rename uses the same directory, basename validation, known-file authorization, stale-mtime checks and atomic `RENAME_EXCL`. Imported originals are never renamed on disk.

## Validation

Synced cleanly onto `origin/main` at `ed75d3d`, installed its locked dependencies with `npm ci`, and rebuilt/retested the combined result.

- TypeScript: passed. ESLint: no errors, six existing warnings.
- Web production, desktop web bundle, core package and native Release app: built successfully. Existing large-bundle warnings remain.
- Web unit/integration: all 1,006 tests passed in 86 files on the final quiet run (`NODE_OPTIONS=--no-experimental-webstorage npm test -- --run --maxWorkers=4`). The flag disables Node 25's experimental storage so JSDOM owns the test storage; CI uses Node 22. An earlier concurrent run had one timeout that passed in isolation and in this full rerun; no timeout or test expectation was weakened.
- Core package: 76 tests passed.
- Native XCTest: 270 passed, zero failures/skips.
- Python workflow/packaging tests: 86 passed; workflow security guard passed.
- Full Playwright matrix on final dependencies: 394 passed, 23 existing skips, six failures. No skips were added. Desktop Chromium and mobile Chromium are green; all new toolbar, rename, settings, output, mobile keyboard and Install navigation checks pass.
- Unsigned DMG mount/layout and structural determinism, Sparkle ZIP and dry-run appcast XML checks: passed. Artifact: `/tmp/doc2md-review-release/doc2md-2.11.1-dev.dmg` (local validation artifact, not a release).
- Actual built native React workspace: visually verified before the clean main sync. Final GUI replay was unavailable because the Mac was locked; final native tests/build/packaging passed.

The same six mobile Safari failures reproduced against an archive of current `origin/main` (`ed75d3d`) with the same refreshed dependencies/browser: Replace All undo, single-replace undo, replacement performance, bulk download count, explicit anchor margin, and unsupported clipboard-write permission. The two baseline undo/performance test files hid the old About overlay in test-only CSS to reach their assertions; no baseline production code was changed. These are existing limits, not a claim that the whole E2E suite is green.

Local unit log: `/tmp/doc2md-pr-review/unit-final-quiet.log`. Other local logs: `/tmp/doc2md-pr-e2e-finalbase.log`, `/tmp/doc2md-main-final-six.log`, `/tmp/doc2md-main-synced-native.xcresult`.

## Known limits

The native launch verification script expects an `app ready` log that the existing native source does not emit. Its automated readiness assertion is therefore inconclusive; separate process/bundle checks and visual inspection of the actual built React workspace succeeded. The installed user app was preserved; validation used the separately built app. Local DMG builds are unsigned and are not published releases.
