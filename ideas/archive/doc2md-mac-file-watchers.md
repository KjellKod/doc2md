# Mac file watchers via NSFilePresenter

Status: archived as not-now/YAGNI on 2026-05-26.

Current decision: do not add live file watchers until there is a real
synced-folder conflict or silent-overwrite report. Existing save-time and
reload-time mtime checks cover the current product need.

Promoted out of `doc2md-ux-hardening-proposal.md` Phase 1 because OS-level
file coordination with iCloud / Dropbox / OneDrive needs its own focused
integration testing.

## Existing partial coverage

`DesktopApp.tsx` already detects mtime mismatches at save time and at reload
time (`DesktopApp.tsx:1389`, `:1614`). This catches the most common
"file changed on disk" scenario after the user explicitly hits Save or Reload.

## What this adds

- Live watcher via `NSFilePresenter` (or a `DispatchSourceFileSystemObject`
  fallback) that detects out-of-band changes while the user has the file
  open and is editing.
- Surface a "file changed on disk, reload?" banner with options:
  - Reload (discard local edits — confirm if dirty).
  - Keep mine (save will create a conflict copy).
- Coordinate writes with `NSFileCoordinator` so iCloud / Dropbox writes
  during our save don't lose either side.

## Risk areas

- iCloud Drive's "evicted file" state (file is replaced by a stub locally;
  open it and the OS streams it back). Watcher must handle the transient
  EOF / size-0 condition.
- Dropbox conflict file generation when our write races a remote write.

## Tests

- XCTest unit coverage of the presenter callbacks + conflict resolution
  policy.
- Manual integration: actual iCloud Documents folder + Dropbox folder.
- Manual integration: external editor mutating the file while doc2md has
  it open.
