# Hey team — doc2md is good, let's make it best-in-class

Great work landing the converter, the browser preview, and the Mac native. The product already does the hard part: client-side conversion, fast, private, ten formats in, clean markdown out. What's missing is the last 20% of editor polish that makes someone open doc2md instead of GitHub or VS Code to scratch out a markdown doc. This is a KISS proposal — small, surgical changes, no rewrites.

## The core observation

Compare the two screenshots. GitHub compresses the entire editor chrome into a single thin bar: mode toggle on one end, indent and soft-wrap on the other, and a find/replace overlay that drops in when you ask for it and disappears when you don't. doc2md's editing view, by contrast, keeps the marketing hero, the long sub-paragraph, the format chips, the upload panel, and the file list visible even after a file is open and the cursor is in the document. All of that is useful on first visit. It is noise the moment we are editing.

The fix is a two-mode layout, not new chrome.

**Landing mode** (no document active) stays exactly as it is today. Hero, drop zone, format chips, install tab. This sells the product and we should not touch it.

**Working mode** (document loaded) collapses the hero to just the logo, turns the upload card into a slim "Open / New / Recent" button group, moves the file list into a left rail that defaults collapsed, and gives the editor full bleed. One toolbar row above the editor: Edit | Preview | LinkedIn — gap — Find — Save (with a "Saved · 2s ago" inline status that replaces the green chip). That's it.

Transition is automatic on first file open and on the first paste over ~200 characters. Clicking the logo or a persistent "Home" affordance returns to landing mode. No new settings. No "compact view" toggle. The app reads what state you're in and adjusts.

## Editor parity with GitHub — what we have, what we're missing

We already have: Edit/Preview toggle, Find, Save state, file rename, soft persistence, paste-from-clipboard, multi-format ingestion.

We're missing four things, in priority order. The first two are the love-at-first-sight ones; ship them first.

**1. Auto-continue lists on Enter.** Inside `- `, `* `, `1. `, `> `, or `- [ ] `, pressing Enter inserts the same prefix on the next line. Pressing Enter on an empty bullet exits the list — delete the marker, return to plain paragraph. Ordered lists auto-renumber when items are inserted or removed. Tab and Shift-Tab indent and outdent the current item or selection. This is the single biggest reason people prefer GitHub's textarea over a plain `<textarea>`. CodeMirror 6 and ProseMirror both have battle-tested implementations; we should not write our own. Watch the IME edge case: auto-insertion during Japanese/Chinese composition is the classic regression. Listen for `compositionstart` and `compositionend` and do not fire the continuation while composing. Validate on at least one CJK keyboard before shipping.

**2. Find & Replace.** We have Find. We need: Replace input, Replace, Replace All, Match Case, Regex, Whole Word, and a "12 of 47" match counter. Single overlay bar at the top of the editor, mirroring GitHub's pattern. ESC closes, Cmd/Ctrl-F opens Find, Cmd/Ctrl-H (or Cmd-Alt-F on Mac, which is what most native editors use) opens with Replace expanded. Two non-negotiables: Replace All must be a single undo step — coalesce into one history entry or users will lose work — and live highlighting must be capped (e.g. 5000 matches with "+ more" indicator) so we don't jank the main thread on a large doc. Tokenize once, search incrementally, cancel in-flight on input change.

**3. Inline formatting shortcuts.** Cmd/Ctrl + B, I, K wraps the selection in `**`, `_`, and `[text](url)`. Selecting text and typing `*`, `_`, backtick, `[`, `(`, or `"` wraps rather than replaces. Cmd-Shift-7 / 8 / 9 toggles ordered, unordered, and task list on the current line or selection. Cheap to implement, and it's the rest of the muscle memory developers already have from GitHub, Notion, Linear, and VS Code.

**4. Block move.** Alt-Up / Alt-Down moves the current line or selected block. Useful, cheap if the editor surface supports it, skip if it isn't. Cmd-D for "select next occurrence" is in the same bucket — nice if free, not worth a week.

Explicitly deprioritized: slash-command palettes, vim/emacs modes, mention pickers, AI-assist inside the editor. They're complexity multipliers and the audience we're courting — people who already write markdown by hand — doesn't need them. Skip.

## Folder view — turning the converter into a browser

Today's model is "open a file" or "drop a file." Fine for one-off conversions; painful the moment someone wants to walk a folder of docs and pick targets one by one. Add a folder view in the left rail with a two-tab switch at the top: **Active** (today's behavior — files you've opened) and **Folder** (a tree rooted at a folder you chose). Cursor's left-rail icon pattern is the reference; we don't need their full Files / Search / Git / Extensions stack, just the two-tab version.

Behavior, kept deliberately small:

- **Open Folder** picks a directory (Mac: `NSOpenPanel` with `canChooseDirectories`; browser: File System Access API, which today is Chromium-only — Safari and Firefox users get a degraded "drag a folder in" path, that's acceptable for v1).
- Show every entry, but **dim and disable files outside our supported set** (`.md`, `.txt`, `.json`, `.csv`, `.tsv`, `.html`, `.docx`, `.xlsx`, `.pdf`, `.pptx`) with a hover tooltip explaining why. Hidden / dot files are hidden by default with a toggle, same as Cursor and VS Code.
- **Never auto-convert.** This is the load-bearing rule. Walking a folder must not silently spin up ten markdown buffers in memory. Single-click selects and shows file info. Double-click on a `.md` or `.txt` opens it directly. Double-click on a binary format (`.docx`, `.pdf`, `.xlsx`, `.pptx`) opens an explicit "Convert this file?" preview with the convert button. The user is always in control of when conversion happens, and we never write to the source file.
- **Convert promotes into Active.** Confirming a conversion creates an unsaved markdown buffer and adds it to the Active tab — same posture as drag-and-drop today. The source file is untouched; the new buffer has no path until the user saves it, at which point it becomes eligible for session restore. Re-converting the same source file should focus the existing buffer rather than spawn a duplicate; surface a "you already have this open" hint instead of letting three copies pile up.
- Folder pick persists. Re-opening the app remembers the last folder root so you don't re-navigate.

This is the change that promotes doc2md from "a converter with an editor attached" to "an editor you can actually browse with." Cursor and VS Code earn daily-driver status partly through that rail; we get most of the benefit with two tabs and one filter.

## Feature hardening — the stuff that bites later

A few things that need to be right before we promote either app harder.

**Autosave needs to be visible.** Replace the static "Saved" chip with "Saved · 2s ago" and degrade to "Unsaved" while dirty. Add a `beforeunload` guard in the browser when there are unsaved changes. Snapshot to localStorage on every keystroke (debounce 500ms) and on `visibilitychange`. On reopen, if the in-progress snapshot differs from the saved doc, prompt for crash recovery. Mind the localStorage quota — it's roughly 5MB per origin; fall back to IndexedDB for docs over ~500KB so we don't silently start dropping saves on long documents.

**Mac native file watchers.** iCloud, Dropbox, and OneDrive will race us. If we write while the cloud agent is mid-sync we either lose edits or generate conflict files. Lock per-file during write, and on read detect mtime mismatches and surface "file changed on disk, reload?" — same pattern VS Code uses. This is not optional once a paying user puts a doc in their iCloud Documents folder.

**Session restore and recent files (Mac).** Use the system-blessed plumbing — don't roll our own. `NSDocumentController` already manages the File → Open Recent menu and persists across launches; route saved files through it and we inherit that submenu plus the standard "Clear Menu" behavior, which is the natural home for our existing Clear function. For "which docs were open when we quit or crashed," the convention is either `NSWindowRestoration` (the Apple-blessed path) or a small JSON at `~/Library/Application Support/doc2md/session.json` listing the absolute paths of currently-open files that have a real path on disk. Per spec: untitled / unsaved buffers are not eligible — only saved files survive a restart. Debounced write on open / close / save. On launch, drop any paths that no longer exist and reopen the rest. Crash on Tuesday, reopen Tuesday's tabs Wednesday morning with zero ceremony. Privacy posture is the same as any Mac editor — list of paths, not contents.

**Tabs vs spaces — detect, don't dictate.** Right now I suspect we insert whatever the Tab key emits, which means the moment someone opens a 2-space-indented doc and our auto-continue fires, we inject a literal tab and the diff looks like a hand grenade. One rule fixes it: detect indent style from the first indented line in the document and reuse it for every subsequent insertion. Persist a global default (2 spaces, per our agreement) for new files only. Document style always wins over global preference. And never reformat existing indentation on save — trust costs one bad diff to lose and months to regain.

**Accessibility from the start.** Every overlay button gets an aria-label. Find bar fully keyboard reachable. ESC always closes overlays and returns focus to the editor. We'll get an a11y issue filed eventually; ship correct so we don't have to retrofit under deadline.

**Find/Replace at scale.** Already mentioned above but worth restating: a naïve `String.matchAll` with a user-supplied regex over a 1MB document on every keystroke will freeze the tab. Incremental search, cancellable, with a hard cap on simultaneous highlights.

## What "done" looks like

A developer opens doc2md, drops in a .docx, hits Edit, types a bullet list with three nested items, opens Find/Replace to fix a recurring typo across the document, hits Cmd-S, closes the tab, comes back tomorrow, and everything is exactly where they left it — without learning anything that isn't already true of GitHub or VS Code. That's the bar.

## Suggested order

Working-mode layout collapse first — biggest perceived quality jump, pure UX, no editor-engine work. Then list auto-continue paired with indent-style detection (they have to ship together; auto-continue is wrong if it ignores the doc's existing indent). Then Find & Replace. Then Mac session restore via `NSDocumentController` + `session.json` — small change, large perceived reliability win. Then folder view with the Active / Folder tab switch. Then inline-format shortcuts. Then autosave and crash-recovery polish. Then Mac file-watcher hardening. Everything else later.

Push back on anything in here that doesn't survive a second look.
