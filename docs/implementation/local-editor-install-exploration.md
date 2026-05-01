# Mac Desktop App Design

Date: 2026-04-21
Status: Active

## 1. Product Statement

`doc2md.app` is a Mac-native document-to-Markdown editor. It converts supported local documents, lets users edit the resulting Markdown, and saves Markdown files directly to disk. The hosted browser version at `https://kjellkod.github.io/doc2md/` remains the public demo, one-off converter, and cross-platform fallback; it should not inherit Mac-only persistence or updater complexity.

## 2. Shell Decision

Build the Mac app as a Swift + SwiftUI/AppKit shell around `WKWebView`, with Sparkle for auto-update.

Swift wins because this product is now explicitly Mac-only: the shell can stay small, native, signed through the Apple-supported path, and focused on filesystem, menus, dialogs, app lifecycle, and Sparkle. The existing React app and `/src/converters/` keep running inside `WKWebView`; the shell does not bundle Node and does not reimplement conversion.

Tauri remains a valid fallback if Windows/Linux become near-term requirements or if Swift becomes a team comfort blocker. It is not the default because a Rust shell plus Tauri IPC is extra machinery for a Mac-only app.

## 3. Architecture

```text
+------------------------------------+
| Webview                            |
|                                    |
| Existing React UI                  |
| Existing /src/converters/          |
| Markdown editor and preview state  |
+-----------------+------------------+
                  |
                  | doc2mdShell bridge
                  | JSON messages + binary payloads
                  v
+------------------------------------+
| JS Bridge                          |
|                                    |
| Promise API for webview calls      |
| Menu/window events into React      |
| Error and conflict normalization   |
+-----------------+------------------+
                  |
                  | WKScriptMessageHandler
                  | evaluateJavaScript events
                  v
+------------------------------------+
| Swift Shell                        |
|                                    |
| Filesystem and atomic writes       |
| NSOpenPanel / NSSavePanel          |
| AppKit menus and shortcuts         |
| Sparkle updater                    |
| Signing, sandbox, notarization     |
+------------------------------------+
```

The webview owns conversion and editor state. The shell owns every operation that requires native trust: file dialogs, file paths, writes, Finder reveal, menus, settings, update checks, window lifecycle, signing, and notarization.

## 4. JS Bridge Contract

Expose one deliberately small bridge at `window.doc2mdShell`. The public contract should stay stable and JSON-shaped even when the internal transport for imported source documents uses a stronger native-to-web handoff.

The shell sets `window.doc2mdShell.version === 1` as the handshake marker. React ignores shells that do not expose version `1`.

Opened Markdown can continue to cross the bridge as text plus metadata. Imported source documents should not be shoved through the bridge as one large base64 JSON payload. For robust non-`.md` opens, the shell should expose an opaque `importUrl` backed by `WKURLSchemeHandler` or an equivalent native-owned handoff so React can reconstruct a real `File` and reuse the existing converter pipeline.

```ts
interface ShellOpenMarkdownOk {
  ok: true;
  kind: "markdown";
  path: string;
  content: string;
  mtimeMs: number;
  lineEnding: "lf" | "crlf";
}

interface ShellOpenImportOk {
  ok: true;
  kind: "import-source";
  path: string;
  name: string;
  format: string;
  mtimeMs: number;
  importUrl: string;
  mimeType?: string;
}

type ShellFile = ShellOpenMarkdownOk | ShellOpenImportOk;

interface ShellOk {
  ok: true;
  path: string;
  mtimeMs: number;
}

interface ShellRevealOk {
  ok: true;
  path: string;
}

interface ShellCancel {
  ok: false;
  code: "cancelled";
}

interface ShellConflict {
  ok: false;
  code: "conflict";
  path: string;
  actualMtimeMs: number;
}

interface ShellError {
  ok: false;
  code: "error";
  message: string;
}

interface ShellPermissionNeeded {
  ok: false;
  code: "permission-needed";
  path?: string;
  message: string;
}

type ShellResult<T> =
  | T
  | ShellCancel
  | ShellConflict
  | ShellPermissionNeeded
  | ShellError;
```

Every successful bridge result includes `ok: true`; every failure includes `ok: false` plus a `code`. `ShellError.message` is user-facing English for MVP. It must not include stack traces, internal implementation details, or file paths outside a user-selected location.

Bridge promises resolve with result objects for all user-visible outcomes. Rejections are reserved for transport or programming faults such as malformed responses or script-message failures.

| Call | Direction | MVP | Signature |
|---|---|---:|---|
| `openFile()` | Webview to shell | Yes | `Promise<ShellResult<ShellFile>>`; shows `NSOpenPanel`; returns `{ kind: "markdown", ... }` for `.md` and `.markdown`, and `{ kind: "import-source", ... }` for every other supported format, including `.txt`. |
| `openFolder()` | Webview to shell | No | Reserved for future folder workspaces only. |
| `saveFile({ path, content, expectedMtimeMs, lineEnding })` | Webview to shell | Yes | `Promise<ShellResult<ShellOk>>`; writes an existing `.md` target if mtime matches. |
| `saveFileAs({ suggestedName, content, lineEnding })` | Webview to shell | Yes | `Promise<ShellResult<ShellOk>>`; shows `NSSavePanel`, then writes Markdown to a chosen `.md` path. |
| `revealInFinder({ path })` | Webview to shell | Yes | `Promise<ShellResult<ShellRevealOk>>`; opens Finder with the saved Markdown file selected. Success is `{ ok: true, path: string }`, where `path` echoes the requested file for React-side logging. |
| `watchFile({ path })` | Webview to shell | No | `Promise<ShellResult<{ ok: true }>>`; future file-change watcher; out of MVP. |
| `checkForUpdates()` | Menu to shell | Yes | Native Sparkle action; does not need webview state. |

Phase 4 exposes only `openFile`, `saveFile`, `saveFileAs`, and `revealInFinder` on `window.doc2mdShell`; `openFolder`, `watchFile`, and `checkForUpdates` are still reserved outside the current web bridge.

Native menu commands flow the other direction as DOM events:

- `doc2md:native-new`
- `doc2md:native-open`
- `doc2md:native-save`
- `doc2md:native-save-as`
- `doc2md:native-close-window`

React handles those events by invoking the same editor actions as toolbar buttons. The shell should not inspect editor state except through bridge responses.

`NSOpenPanel` filters must follow the app's supported-format source of truth: `SUPPORTED_FORMATS` in `src/types/index.ts` and the converter registry in `src/converters/index.ts`. If Swift needs a copied extension list, add a build/test check so it cannot drift silently when converters change.

## 5. File Semantics

**Atomic writes**: Always write atomically. The shell writes to a temp file in the same directory, fsyncs where practical, then calls `FileManager.replaceItem(at:withItemAt:backupItemName:options:resultingItemURL:)` for the final replacement. Use this macOS primitive instead of a bare rename so replacement preserves metadata behavior better across permissions, extended attributes, quarantine flags, Spotlight metadata, and iCloud/Dropbox-coordinated folders.

**Conflict detection**: Store `mtimeMs` when a file is opened or saved. `saveFile()` must compare `expectedMtimeMs` to the current file mtime before writing. If it drifted, return `conflict`; the UI prompts the user to reload or Save As. Three-way merge is later.

**Overwrite policy**: Opening an existing `.md` file grants an unprompted Save back to that same file if mtime matches. Every other supported format, including `.txt`, is an import-only source document from the user's perspective: React converts it to editable Markdown, but the original source file is never overwritten. Unknown-target documents, scratch drafts, and imported documents use Save As first. The selected Save As target is remembered for the current session.

**Backups**: Off by default. A single setting can enable `file.md.bak` before overwriting an existing target. Backups do not replace atomic writes or conflict checks.

**Line endings**: Preserve the original line ending for opened `.md` files. Detection rule: sample the first 4 KB; if any `\r\n` appears, treat the file as CRLF, otherwise LF. New scratch files and imported Markdown default to LF.

**Imported assets**: Match the hosted web product. Embedded images and other source-document assets are dropped; the app does not write `name.assets/` folders in this version. If shared converter behavior changes later, update the converter contract, save semantics, and roadmap in the same phase.

**Sandbox access**: The app should be sandboxed for distribution. User-selected file access comes through `NSOpenPanel` and `NSSavePanel`. Imported source documents require read access to the chosen source path and write access only to the eventual `.md` save target. No extra folder grant is required for sibling asset folders in this version because the app does not persist them.

## 6. Menus And Shortcuts

| Menu | Shortcut | Action |
|---|---|---|
| File > New | Cmd+N | Create an untitled Markdown draft. |
| File > Open... | Cmd+O | Open a Markdown file or supported source document. |
| File > Save | Cmd+S | Save to the current target, or route to Save As if none exists. |
| File > Save As... | Cmd+Shift+S | Choose a Markdown target. |
| File > Reveal in Finder | None | Reveal the saved Markdown file. Disabled without a saved path. |
| File > Close Window | Cmd+W | Close the current window after dirty-state handling. |
| App > Settings... | Cmd+, | Open settings for backups and update preferences. |
| App > Check for Updates... | None | Trigger Sparkle update check. |
| Edit | Standard | Undo, Redo, Cut, Copy, Paste, Select All flow to the webview. |

The toolbar can keep product-specific actions, but native menu behavior must work even when the focused element is the Markdown textarea. Standard Edit menu items should rely on AppKit's first-responder chain into the focused `WKWebView`; do not route Undo, Redo, Cut, Copy, Paste, or Select All through the custom shell bridge.

The app should follow standard Mac lifecycle behavior: closing the last window leaves the app running. Activating the Dock icon with no open window creates a new untitled window.

Settings such as backup toggle, update preferences, and beta-update opt-in live in `UserDefaults` for MVP.

## 7. Auto-Update

Use Sparkle 2 for updates. The app includes `SPUStandardUpdaterController`, a `Check for Updates...` menu item, `SUFeedURL`, and `SUPublicEDKey` in `Info.plist`. Sparkle's documentation supports Swift Package Manager integration, EdDSA update signatures, appcast feeds, and DMG/ZIP-style update archives.

The appcast should live at a stable HTTPS URL under the canonical Mac app domain once DNS and release hosting are configured:

```text
https://updates.doc2md.dev/appcast.xml
https://updates.doc2md.dev/appcast-beta.xml
```

Use a DMG for first install and a ZIP of the `.app` bundle for Sparkle updates. Sparkle's publishing docs show `ditto -c -k --sequesterRsrc --keepParent MyApp.app MyApp.zip` for ZIP creation; use that form so symlinks and resource forks are preserved. The release process signs the ZIP update archive with Sparkle EdDSA. The private key lives outside the repo in 1Password or equivalent secret storage. The appcast can be generated with Sparkle's `generate_appcast` tooling. GitHub Releases can hold versioned DMG and ZIP artifacts; `doc2md.dev` provides the stable public domain for production and beta appcasts.

## 8. Signing And Notarization

Distribution requires an Apple Developer account, a Developer ID Application certificate, hardened runtime, notarization, and stapling before the DMG is published. Apple's Xcode documentation states that Developer ID distribution can upload archives for notarization and that hardened runtime must be enabled before upload.

Use bundle identifier `com.kjellkod.doc2md` unless the Apple Developer account or product ownership requires a different reverse-DNS value before the first signed release. The Apple Team ID comes from the Developer account and CI keychain, not from committed repo config. Avoid changing the bundle identifier after Sparkle updates ship because it affects update continuity.

Initial entitlements:

```xml
<key>com.apple.security.app-sandbox</key>
<true/>
<key>com.apple.security.files.user-selected.read-write</key>
<true/>
<key>com.apple.security.network.client</key>
<true/>
```

Add `com.apple.security.files.bookmarks.app-scope` only when recent files or persisted file access move into scope. Avoid broad filesystem or JIT entitlements unless a signed build proves they are required.

Release outline:

1. Build the desktop web bundle.
2. Copy it into the Mac app resources.
3. Archive the app with Xcode or `xcodebuild archive`.
4. Export Developer ID signed app with hardened runtime.
5. Package a DMG with `/Applications` symlink.
6. Notarize with Xcode Organizer or `xcrun notarytool`.
7. Staple and validate the notarization ticket.
8. Create the Sparkle ZIP update archive with `ditto`.
9. Sign the update ZIP with Sparkle EdDSA.
10. Generate and publish `appcast.xml`.

For CI notarization, run `xcrun notarytool store-credentials` once against the CI keychain with an Apple app-specific password or App Store Connect API key. Keep that credential separate from the Sparkle EdDSA private key; they solve different trust problems.

## 9. Repo Layout And Build

Use `apps/macos/` for the Swift shell.

```text
apps/macos/
  doc2md.xcodeproj
  doc2md/
    AppDelegate.swift
    WebViewController.swift
    ShellBridge.swift
    FileStore.swift
    MenuController.swift
    SparkleController.swift
    SettingsStore.swift
    Resources/
      Web/
```

The hosted web app stays rooted at the current Vite/React source. The Mac build should produce a desktop web bundle from the same source and copy it into `apps/macos/doc2md/Resources/Web/`.

The current root `vite.config.ts` uses `base: "/doc2md/"` for GitHub Pages. Add a desktop Vite mode or config override that sets `base: "./"` so bundled resources resolve as relative paths when loaded from `file://` or a `WKWebView` custom scheme.

The Xcode target should include a Run Script build phase before Copy Bundle Resources. That phase runs the desktop Vite build and copies `dist/` into `apps/macos/doc2md/Resources/Web/`, which is then wired into the app bundle as a resource. Keeping this inside the target avoids parallel ad hoc build scripts.

Use scheme-specific build configuration for webview source selection: Debug loads `http://localhost:5173` for fast React iteration, and Release loads the bundled `Resources/Web/index.html`. A missing dev server in Debug should show a clear local development error instead of a blank webview.

Local build pipeline:

1. `npm install`
2. `npm run build -- --mode desktop` or equivalent desktop web build command
3. Copy `dist/` into the Mac app resource folder
4. `xcodebuild archive`

The CLI build pipeline mirrors the Xcode build phase for CI and local release automation; Xcode remains the source of truth for local app builds. Section 8 is the canonical signed release and notarization checklist.

## 10. MVP Scope

MVP acceptance criteria:

- A user can open an existing `.md` file, edit it, and save back to the same file with Cmd+S.
- A user can create a new draft and Save As to a chosen `.md` file.
- A user can open any supported non-`.md` source document, including `.txt`, convert it in the existing webview converter path, edit the Markdown, and Save As to `.md`.
- After first Save As, continued editing saves back to the chosen `.md` target with conflict detection.
- Embedded images and other assets are dropped consistently with the hosted web behavior.
- Save rejects when the target file changed externally after open or last save.
- Save writes atomically and does not leave a partial Markdown file.
- The app exposes native File menu commands for New, Open, Save, Save As, Close, Settings, and Check for Updates.
- The app can reveal a saved Markdown file in Finder.
- Sparkle can check a test appcast and identify a newer signed update.
- The app can be signed, notarized, stapled, installed from a DMG, and launched on macOS 13+.
- The app launches offline without blocking on Sparkle or network access.

Validation:

- Unit-test Swift open/save helpers for atomic write, mtime conflict, backup toggle, and imported-source open handling.
- Unit-test `ShellBridge` JSON decoding/encoding for success, cancel, conflict, and error paths.
- Add React tests for native menu event handling and desktop save-state transitions.
- Inject a mock `window.doc2mdShell` in React tests so bridge success, cancel, conflict, and error paths can be tested without launching Xcode or `WKWebView`.
- Manually test open/edit/save, Save As, imported-source conversion/save, conflict, reveal in Finder, offline launch, update check, DMG install, and notarized launch.

## 11. Out Of Scope

- Hosted browser File System Access.
- Localhost editor server.
- Windows and Linux builds.
- VS Code extension.
- Watch-and-reconvert.
- Folder-as-workspace.
- Recent files menu.
- Persisted security-scoped bookmarks.
- Autosave.
- Dirty-buffer crash recovery. MVP accepts data loss for unsaved editor buffers after an app or OS crash.
- Syntax highlighting upgrade.
- iCloud sync.
- Multiple windows.
- Multi-file undo across Save.
- Three-way merge.
- OCR or improved conversion quality.
- Native reimplementation of converters.

## 12. Product Decisions

1. **Swift or Tauri?** Swift. Tauri is fallback only if cross-platform desktop becomes important.
2. **Preserve embedded assets from source documents?** No. Match hosted web behavior and drop them in this version.
3. **Where does the appcast live?** Under `https://updates.doc2md.dev/` once the commercial/update domain is configured. GitHub Releases can continue storing versioned artifacts behind that stable public URL.
4. **Updater?** Sparkle 2 with EdDSA-signed update archives.
5. **macOS minimum?** macOS 13 Ventura for MVP. It keeps the test matrix small while covering Sparkle 2 defaults, Swift 5.7-era concurrency, and current `WKWebView` behavior.
6. **Does the Mac app import hosted browser scratch drafts?** No.
7. **Does the shell bundle Node?** No.
8. **Do recent files ship in MVP?** No. Add security-scoped bookmarks only when recent files are in scope.
9. **Does Save overwrite an opened Markdown file without prompting?** Yes, if mtime matches.
10. **Does converted output default beside the source file?** No. Imported documents require explicit Save As to `.md`.

## 13. Alternatives Considered

Browser File System Access was the right first validation path when the target was "lightweight local install" across the existing hosted app. With Mac-only DMG now explicit, it becomes unnecessary for MVP and would create a capability split in the hosted browser product.

A localhost server from `npm install` would solve cross-browser file access without native packaging, but Mac-only DMG makes that the wrong user experience. It also adds local HTTP security work that a native shell avoids.

Tauri remains a credible fallback because it also uses the system webview on macOS and brings packaged filesystem/dialog/updater plugins. For Mac-only, Swift is smaller, more native, and keeps the shell in Apple's primary tooling.

Electron is not justified for this scope. It adds a large runtime to host a web app that can run in `WKWebView`.

A VS Code extension could be useful later for developer workflows, but it is not the product described here.

## References

- Sparkle documentation: https://sparkle-project.org/documentation/
- Sparkle publishing documentation: https://sparkle-project.org/documentation/publishing/
- FileManager replacement API: https://developer.apple.com/documentation/foundation/filemanager/replaceitem%28at%3Awithitemat%3Abackupitemname%3Aoptions%3Aresultingitemurl%3A%29
- Apple notarization documentation: https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution
- Apple notarization workflow customization: https://developer.apple.com/documentation/security/customizing-the-notarization-workflow
- Xcode notarization guide: https://help.apple.com/xcode/mac/current/en.lproj/dev88332a81e.html
- WKScriptMessageHandler documentation: https://developer.apple.com/documentation/webkit/wkscriptmessagehandler
- App Sandbox file access documentation: https://developer.apple.com/documentation/security/accessing-files-from-the-macos-app-sandbox
