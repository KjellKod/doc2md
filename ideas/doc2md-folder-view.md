# Folder view (Active / Folder tabs)

Promoted out of `doc2md-ux-hardening-proposal.md` Phase 1 because it is a
substantial standalone feature with two distinct shells (browser FS API +
Mac NSOpenPanel) and a new left-rail tree component.

## Acceptance criteria (draft)

- Two-tab switch in the left rail: **Active** (existing entries) and **Folder**
  (tree rooted at a chosen directory).
- "Open Folder" picker:
  - Browser: File System Access API (Chromium-only); Safari/Firefox degrade
    to drag-folder-in.
  - Mac native: extend `ShellBridge` with a new `chooseDirectory` command
    (currently `canChooseDirectories = false` in both `ShellBridge.swift:146`
    and `WebShellView.swift:180`).
- Tree shows every entry; supported extensions (`.md`, `.txt`, `.json`,
  `.csv`, `.tsv`, `.html`, `.docx`, `.xlsx`, `.pdf`, `.pptx`) are full
  contrast; others are dimmed and disabled with a hover tooltip.
- Hidden / dot files are hidden by default with a toggle.
- **Never auto-convert.** Single-click selects + shows file info. Double-click
  on `.md`/`.txt` opens directly. Double-click on a binary format opens a
  "Convert this file?" preview with the convert button. The source file is
  never written.
- Confirming a conversion creates an unsaved markdown buffer and adds it to
  the Active tab.
- Re-opening a previously-opened source focuses the existing buffer and
  surfaces a "you already have this open" hint.
- Folder root persists across reloads.

## Out of scope

- Two-way sync with the folder.
- File operations (rename, move, delete) on the source tree.

## Why not in Phase 1

Substantial scope: new component, browser FS API surface, Mac bridge
extension, supported/unsupported dimming, persistence, dedup logic on
re-open. Belongs in its own quest with focused review.
