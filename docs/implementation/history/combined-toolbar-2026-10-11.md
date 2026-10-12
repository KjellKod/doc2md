# Combined toolbar implementation

Status: Complete. User approved B and implementation on October 11, 2026.

Acceptance: one combined desktop row, compact responsive layout; icon actions with hover/focus labels; single gear with appearance, line-number checkbox, native persistence, secondary document actions and help; preserve conversions, editing, export, save/conflict and native recents; click title to rename Markdown output, native saved Markdown rename safely, Enter/Escape and errors; test and self-review before completion.

- [x] Integrate shared toolbar and settings with existing adapters.
- [x] Implement output/native document renaming and tests.
- [x] Verify layouts, run relevant tests/builds and self-review.

The user approved the existing B prototype, not a new design direction. Existing CSS width animation remains unchanged. Existing uncommitted UX work is preserved.

## Implementation and review

The production web and desktop shells now use B. The compact toolbar is shared with PreviewPanel through a portal, so editor state and existing save/copy/find/export handlers retain a single owner. Settings groups Appearance, native Persistence/recents, the Line numbers checkbox, document actions and app information. Secondary commands close the popover; Clear history keeps it open. Native conflicts/notices remain visible. The original width animation is unchanged.

Inline rename protects `.md`, confirms with Enter, cancels with Escape, reports invalid names and preserves editor content/mode. Browser/import renames change the output filename. Native saved Markdown renames use an additive bridge capability, stale-mtime checks and atomic no-overwrite rename; subsequent saves, recents and the document library follow the new path. Older native shells show an actionable error. Case-only renames were verified on the local case-insensitive APFS volume, with bytes and mtime preserved.

Self-review fixed edit-mode resets on rename, hidden mobile save errors, settings command dismissal, mobile input zoom, and settings grouping. No remaining blocking findings in the reviewed feature scope. Existing standalone PreviewPanel callers retain their original toolbar.

Validation and independent review are recorded in [the final review record](combined-toolbar-review-2026-10-11.md). The prior packaging-test environment failure was reproduced and fixed in the test harness. The actual built native workspace was visually verified. The user subsequently authorized committing and creating a draft PR after review fixes; no deployment or published installer release is included.

Follow-up: removed routine browser Ready to download/Not downloaded pills. Availability is represented by the download button, with a disabled explanation on hover or keyboard focus. Download dispatch feedback and errors remain. Empty scratch drafts, missing documents, pending/failed conversions and an in-flight download preparation disable downloading.
