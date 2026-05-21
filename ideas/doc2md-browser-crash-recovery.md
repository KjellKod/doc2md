# Browser draft crash recovery (reload-surviving)

Promoted out of `doc2md-ux-hardening-proposal.md` Phase 1. Phase 1 ships
**in-session protection only** (React state preserves drafts across entry
switches and tab toggles). True reload-surviving recovery needs a stable
identity layer that the current architecture doesn't provide.

Status checked after PR #140 merged: still open for hosted reload-surviving
draft recovery. The app now has in-session state protection and a
`beforeunload` guard for dirty work, and the Mac app has separate session
restore. Those are useful shipped protections, but they are not this idea.
This idea remains specifically about recovering unsaved hosted-browser drafts
after reload, tab crash, or browser restart.

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
