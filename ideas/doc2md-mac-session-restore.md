# Mac session restore (NSDocumentController + session.json reopen)

Promoted out of `doc2md-ux-hardening-proposal.md` Phase 1. Two sub-pieces
worth doing together.

## Existing partial coverage

`apps/macos/doc2md/PersistenceStore.swift` already maintains a
`recentFiles: [RecentFile]` array (max 10), persisted to
`~/Library/Application Support/doc2md/settings.json`. It is NOT surfaced
in the File menu yet — `MenuController.swift` has no Open Recent wiring.

## Sub-piece 1: NSDocumentController Open Recent submenu

- Call `NSDocumentController.shared.noteNewRecentDocumentURL(_:)` from the
  Mac shell whenever a file is opened or saved.
- The standard File → Open Recent submenu (with the system-provided "Clear
  Menu" item) wires up automatically.
- Replace the hand-rolled `PersistenceStore.recentFiles` storage with the
  Apple-blessed shared `NSDocumentController` recent-document list.

## Sub-piece 2: session.json reopen-on-launch

- Persist a small JSON file at
  `~/Library/Application Support/doc2md/session.json` listing the absolute
  paths of currently-open files that have a real path on disk.
- Untitled / unsaved buffers are NOT eligible — only saved files.
- Debounced write on open / close / save.
- On launch, drop any paths that no longer exist and reopen the rest.

## Privacy

List of paths, not contents. Same posture as any standard Mac editor.

## Tests

- XCTest: `recordRecentFile` updates the shared NSDocumentController list.
- XCTest: `session.json` is written on open and pruned on launch when a
  path no longer exists.
- Manual: open three files, quit, relaunch, all three reopen with the
  same selection.
