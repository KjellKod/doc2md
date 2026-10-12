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

Final verification results are being consolidated after syncing the default branch.

## Known limits

The native launch verification script expects an `app ready` log that the existing native source does not emit. Its automated readiness assertion is therefore inconclusive; separate process/bundle checks and visual inspection of the actual built React workspace succeeded. The installed user app was preserved; validation used the separately built app. Local DMG builds are unsigned and are not published releases.
