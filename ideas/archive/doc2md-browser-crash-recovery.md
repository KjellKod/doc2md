# Browser draft crash recovery (reload-surviving)

Status: archived as not now.

Archived: 2026-05-26.

Decision: do not add hosted-browser persisted draft recovery until real user
evidence justifies it. The hosted app already warns on dirty navigation with
`beforeunload`; if users ignore that and do not save/download their draft, this
is not current product scope.

Promoted out of `doc2md-ux-hardening-proposal.md` Phase 1. Phase 1 ships
**in-session protection only** (React state preserves drafts across entry
switches and tab toggles). True reload-surviving recovery needs a stable
identity layer that the current architecture doesn't provide.

Status checked after PR #140 merged: the feature was not implemented for hosted
reload-surviving draft recovery. On 2026-05-26 we chose not to pursue it until
real user data-loss evidence appears. The app now has in-session state
protection and a `beforeunload` guard for dirty work, and the Mac app has
separate session restore. Those are enough for current scope.

## The blocker

Entries are React state (`useFileConversion.ts`). IDs are generated fresh at
create time. After a reload, no entries exist yet, so any
`doc2md.draft.<entryId>` snapshot is unreachable.

## What this adds

- A stable snapshot index (`doc2md.drafts.index`) storing
  `{ id, title, sourceKind, savedAt, dirty }` for each draft.
- Persisted entry identity: scratch entries get a deterministic ID derived
  from the snapshot index, not a fresh UUID per session.
- A boot-time recovery surface BEFORE any entry is loaded — either a small
  banner ("Unsaved drafts from last session: Restore | Discard") or
  pre-populating the Active list from the index.
- `localStorage.setItem` snapshot writes debounced 500ms on edit; immediate
  on `visibilitychange`.
- IndexedDB fallback for drafts over ~500KB (UTF-16 code-unit length) OR
  when `localStorage.setItem` throws `QuotaExceededError`.
- Snapshot cleared on successful Save and on Clear.

## Tests

- Unit: debounce, immediate-on-hide, quota-exception fallback, save/clear
  lifecycle.
- E2E: type → reload → recovery surface appears → restore → content
  preserved.
- Privacy: snapshots include only the draft content, not file paths.

## Why not in Phase 1

Architectural change (stable identity, boot-time recovery surface) plus
storage-engine surface (localStorage vs IndexedDB DI). Splitting it lets
Phase 1 ship the keyboard + layout polish without dragging a partial
recovery layer over the line.
