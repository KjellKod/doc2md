# Mac Desktop App Roadmap

Status: active
Owner: maintainers
Design doc: [Mac Desktop App Design](../docs/implementation/local-editor-install-exploration.md)

## Purpose

Track the Mac-only `doc2md.app` work across multiple quests and PRs. The design doc defines the product and technical contract; this roadmap defines sequencing, PR boundaries, dependencies, and completion criteria.

The work should not ship as one PR. It crosses repo structure, Xcode project setup, React desktop-mode integration, native Swift filesystem behavior, asset persistence, and release infrastructure. Each phase should be independently reviewable and should leave the repo in a working state.

## Product Target

Build a Mac-native DMG app using Swift + `WKWebView` + Sparkle. The existing hosted browser app remains unchanged for cross-platform use. The Mac shell owns native filesystem, dialogs, menus, signing, notarization, and update checks. The React app and existing converters continue to own conversion, editing, preview, and Markdown state.

## Phase Overview

| Phase | Status | Quest / PR | Goal | Blocks |
|---|---|---|---|---|
| 0. Design and Roadmap | active | Current docs | Freeze product direction and PR sequence. | Phase 1 |
| 1. Mac Shell Scaffold | planned | TBD | Add `apps/macos/`, Xcode shell, desktop web bundle path, Debug/Release loading. | Phase 2 |
| 2. Bridge and React Desktop Mode | planned | TBD | Add bridge types, mock shell, native menu events, desktop save-state plumbing. | Phase 3 |
| 3. Markdown File Persistence | planned | TBD | Implement open/save/save-as for Markdown with atomic replace, mtime conflicts, line endings, Finder reveal. | Phase 4 |
| 4. Converted Document and Asset Persistence | planned | TBD | Save converted output with `name.assets/` folder semantics and session-owned asset rewrites. | Phase 5 |
| 5. Distribution and Updates | planned | TBD | Add Sparkle, DMG install, ZIP updates, signing/notarization docs and release workflow. | MVP ship |

## Phase 0: Design And Roadmap

Scope:

- Maintain the design doc in `docs/implementation/local-editor-install-exploration.md`.
- Maintain this roadmap in `ideas/mac-desktop-app-roadmap.md`.
- Keep `ideas/README.md` linked to the roadmap.

Done when:

- Shell choice is explicit: Swift + `WKWebView` + Sparkle.
- MVP and out-of-scope lists are documented.
- Roadmap phases are PR-sized and ordered.

## Phase 1: Mac Shell Scaffold

Goal:

Create a minimal Mac app shell that can load the existing React app in development and from bundled resources in release.

Expected changes:

- Add `apps/macos/` with an Xcode project and Swift app skeleton.
- Add desktop Vite mode/config so the web bundle uses `base: "./"`.
- Add an Xcode Run Script phase before Copy Bundle Resources to build/copy the desktop web bundle.
- Configure Debug to load `http://localhost:5173`.
- Configure Release to load bundled `Resources/Web/index.html`.
- Add a clear Debug error view when the Vite dev server is unavailable.

Acceptance criteria:

- Debug Mac app launches and loads the Vite dev server.
- Release-style local build loads bundled static assets from app resources.
- Hosted browser build remains unchanged with `base: "/doc2md/"`.
- No native file persistence or bridge commands are required yet.

Validation:

- Run existing web tests.
- Build the desktop web bundle.
- Launch the Mac shell in Debug and Release-style local configuration.

## Phase 2: Bridge And React Desktop Mode

Goal:

Introduce the JS bridge contract and React desktop-mode behavior without real filesystem writes.

Expected changes:

- Add TypeScript declarations for `window.doc2mdShell`.
- Add a mock bridge for web tests and local non-shell rendering.
- Add native menu event listeners for New, Open, Save, Save As, and Close.
- Add desktop save-state model: `Saved`, `Edited`, `Saving`, `Conflict`, `Error`, `Permission needed` if needed.
- Add shell command stubs in Swift returning clear not-implemented errors.
- Ensure standard Edit menu actions use AppKit responder chain, not custom bridge calls.

Acceptance criteria:

- React can run with or without `window.doc2mdShell`.
- Native menu events trigger the same React actions as toolbar controls.
- Tests cover bridge success, cancel, conflict, and error handling through a mock shell.
- No real file writes occur in this phase.

Validation:

- Run React unit tests.
- Launch shell and verify menu events reach the webview.
- Verify hosted browser behavior has no visible desktop-only controls unless capability-gated.

## Phase 3: Markdown File Persistence

Goal:

Implement safe local persistence for Markdown files.

Expected changes:

- Implement `openFile()` for `.md` files.
- Implement `saveFile()` and `saveFileAs()` for Markdown.
- Use `FileManager.replaceItem(at:withItemAt:backupItemName:options:resultingItemURL:)` for final replacement.
- Track `mtimeMs` and reject saves on conflict.
- Preserve line endings by sampling the first 4 KB.
- Add optional backup setting plumbing, default off.
- Implement `revealInFinder()`.

Acceptance criteria:

- User opens an existing `.md`, edits, and saves with Cmd+S.
- User creates a new draft and saves with Cmd+Shift+S.
- Save rejects when the file changed externally since open or last save.
- Save is atomic and does not leave partial files.
- Finder reveal works for saved files.

Validation:

- Swift unit tests for `FileStore`: atomic replace, mtime conflict, CRLF/LF detection, backup toggle, cancel/error mapping.
- React tests for save-state transitions.
- Manual open/edit/save, Save As, external conflict, and Finder reveal checks.

## Phase 4: Converted Document And Asset Persistence

Goal:

Persist converted document output, including asset folders when converters emit assets.

Expected changes:

- Route supported source documents through existing webview converters after native open.
- Save converted output only via explicit Save As on first save.
- Write `name.md` plus sibling `name.assets/` for asset-bearing conversions.
- Track asset folders created in the current session.
- Rewrite the entire owned asset folder on subsequent saves from the same session.
- Return conflicts for pre-existing asset folders not owned by the session.
- Use chunked bridge or `WKURLSchemeHandler` for payloads above 4 MB if needed.

Acceptance criteria:

- User opens a supported source document, reviews/edits Markdown, and saves via Save As.
- Asset-bearing output uses relative links into `name.assets/`.
- Re-saving an owned asset folder is deterministic.
- Existing unowned asset folders are not silently merged or overwritten.

Validation:

- Unit tests for asset folder naming, conflict detection, owned-folder rewrite, and relative link generation.
- Manual conversion/save for at least one text-only source and one asset-bearing fixture.
- Regression check that hosted browser download flow still works.

## Phase 5: Distribution And Updates

Goal:

Make the Mac app installable and updateable outside the App Store.

Expected changes:

- Add Sparkle 2 integration.
- Add `SUFeedURL`, `SUPublicEDKey`, production appcast, and beta appcast.
- Use DMG for first install.
- Use ZIP of the `.app` bundle for Sparkle updates.
- Document and script release steps for Developer ID signing, hardened runtime, notarization, stapling, Sparkle signing, and appcast generation.
- Keep Apple notarization credentials separate from Sparkle EdDSA keys.

Acceptance criteria:

- App installs from a DMG and launches on macOS 13+.
- Signed/notarized/stapled app passes local validation.
- Sparkle can detect a newer signed update from a test appcast.
- Offline launch does not block on update checks.

Validation:

- Manual DMG install.
- Manual offline launch.
- Manual Sparkle update check against test appcast.
- Release dry run using local or test credentials where possible.

## MVP Ship Criteria

MVP is ready when:

- Phases 1-5 are complete.
- Hosted browser behavior is unchanged.
- `doc2md.app` can open, edit, save, Save As, reveal in Finder, and handle conflicts.
- Converted document Save As works for supported source formats.
- Asset folder semantics are implemented or explicitly deferred from the shipped converter behavior.
- App can be signed, notarized, packaged as DMG, and updated through Sparkle ZIP updates.

## Cross-Phase Rules

- Do not move the hosted browser app into a new folder unless a phase proves it is necessary.
- Keep `/src/converters/` as the shared conversion source of truth.
- Keep Swift shell code focused on native trust boundaries; do not reimplement conversion in Swift.
- Keep hosted browser controls unchanged unless capability-gated for desktop.
- Keep every PR reviewable with focused tests.
- Avoid release/signing work until shell, bridge, and persistence behavior are stable.

## Out Of Scope For MVP

- Hosted browser File System Access.
- Localhost editor server.
- Windows/Linux desktop builds.
- VS Code extension.
- Folder workspaces.
- Recent files.
- Security-scoped bookmark persistence.
- Autosave.
- Dirty-buffer crash recovery.
- Multiple windows.
- Three-way merge.
- OCR or converter quality upgrades.

## Tracking Notes

- Each phase should become a separate quest or a tightly scoped group of quests.
- Each PR should link this roadmap and the design doc.
- If implementation changes a contract in the design doc, update both the design doc and this roadmap in the same PR.
- Completed phases should move from `planned` to `done` with PR links added to the phase table.
