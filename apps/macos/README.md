# doc2md Mac Shell

This is the Phase 4 Mac-only shell for `doc2md.app`. It is a minimal Swift + SwiftUI + `WKWebView` app that displays the existing React UI, edits `.md` files directly, and imports every other supported source format into Markdown through the shared web converters.

Out of scope for this phase: persisted security-scoped bookmarks, Sparkle, signing, notarization, recent files, autosave, and asset persistence.

## Phase 4 Capabilities

- `window.doc2mdShell.version === 1` is injected into the `WKWebView` at document start.
- The bridge exposes `openFile`, `saveFile`, `saveFileAs`, and `revealInFinder`.
- Open reads `.md` and `.markdown` files directly, preserving LF/CRLF metadata for later saves.
- Open imports every other supported format, including `.txt`, `.json`, `.csv`, `.tsv`, `.html`, `.docx`, `.xlsx`, `.pdf`, and `.pptx`, through a one-shot native handoff back into the existing web conversion pipeline.
- First save for an imported document always goes through `Save As` to a chosen `.md` target. After that, Cmd+S updates the chosen Markdown file with the same mtime conflict detection used for directly opened `.md` files.
- Save writes through a sibling temp file and `FileManager.replaceItemAt`, with mtime conflict detection. Save targets must use the `.md` extension.
- Save As uses `NSSavePanel`; Reveal in Finder uses `NSWorkspace`.
- Current-session security-scoped URLs are retained in memory only.
- File menu commands dispatch `doc2md:native-new`, `doc2md:native-open`, `doc2md:native-save`, `doc2md:native-save-as`, `doc2md:native-reveal-in-finder`, and `doc2md:native-close-window` into the webview.
- Standard Edit actions remain on the AppKit and `WKWebView` responder chain.
- Embedded images and other source-document assets are dropped, matching the hosted web product.

## Debug Development

1. Install web dependencies from the repo root:

   ```bash
   npm install
   ```

2. Start the Vite dev server:

   ```bash
   npm run dev
   ```

3. Open `apps/macos/doc2md.xcodeproj` in Xcode.

4. Select the `doc2md` scheme and run the Debug configuration.

The Debug app loads `http://localhost:5173` in `WKWebView`. Vite uses `strictPort`, so `npm run dev` fails clearly if that port is already occupied. If the Vite dev server is not running, the app shows a visible local-development error instead of a blank window.

## Desktop Web Bundle

Build the desktop web bundle from the repo root:

```bash
npm run build:desktop
```

This uses Vite desktop mode and emits relative asset paths so the bundle can be loaded from app resources.

## Release-Style Local Build

Build the Release configuration with Xcode:

```bash
xcodebuild -project apps/macos/doc2md.xcodeproj -scheme doc2md -configuration Release build
```

Release-style builds run the Xcode `Build Desktop Web Bundle` phase before Copy Bundle Resources. That phase runs `npm run build:desktop` and copies `dist/` into `apps/macos/doc2md/Resources/Web/`, which is bundled as `Web/index.html` inside the app.

`npm run build:desktop` runs `npm run generate:mac-supported-formats` first so the Swift open-panel extension list stays in sync with `SUPPORTED_FORMATS` from `src/types/index.ts`.

If Xcode cannot find `npm` from its GUI environment, set `NPM_BIN` to an absolute npm executable path for the build.

Example:

```bash
NPM_BIN="$(command -v npm)" xcodebuild -project apps/macos/doc2md.xcodeproj -scheme doc2md -configuration Release build
```

## One-Command Release Build

Build the Release `.app` from the repo root:

```bash
npm run build:mac
```

Equivalent:

```bash
bash scripts/build-mac-app.sh --configuration Release
```

The script first checks that `apps/macos/doc2md/SupportedFormats.generated.swift` is up to date, then runs `npm run build:desktop`, invokes `xcodebuild` with `-derivedDataPath .build/mac`, and runs a positive native file API allowlist scan across `apps/macos/doc2md/*.swift`. It writes the app to:

```text
.build/mac/Build/Products/Release/doc2md.app
```

The final output line is:

```text
Built: <absolute path to .build/mac/Build/Products/Release/doc2md.app>
```

Every pull request against `main` runs this unsigned Release build on `macos-latest` through [`.github/workflows/mac-pr-check.yml`](../../.github/workflows/mac-pr-check.yml), so Mac regressions surface before merge.

This is an unsigned local build. Signing, notarization, DMG packaging, and Sparkle updates are Phase 5.

If `xcode-select -p` points at `/Library/Developer/CommandLineTools`, the helper tries `/Applications/Xcode.app/Contents/Developer` and fails with a full-Xcode error if that developer directory is unavailable. Install full Xcode and select it:

```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
```

## Launch Smoke

Build and sanity-check that the Release app renders:

```bash
./scripts/verify-mac-release-launch.sh
```

Use a longer or shorter launch wait when needed:

```bash
./scripts/verify-mac-release-launch.sh --wait-seconds 5
```

The smoke runs the build helper, captures a launch timestamp, launches the resolved `.app` with `open -na`, waits three seconds by default, then queries the macOS unified log (anchored to that launch timestamp, not a rolling window) for `load succeeded` and `app ready: true` entries from the `com.kjellkod.doc2md` subsystem. Anchoring the query prevents a prior run's log entries from being mistaken for the current launch's. It exits non-zero if:

- the process is not running after the wait,
- a `load failed` or `bundle missing` entry appears in the log, or
- `app ready: false` appears in the log, or
- `load succeeded` appears without `app ready: true` within the wait window (reported as `INCONCLUSIVE`, with the `log show` exit status and stderr included so log-access problems surface instead of silently passing).

If the smoke reports `INCONCLUSIVE`, rerun with a larger `--wait-seconds` (log delivery can lag) or check whether `log show` can read the `com.kjellkod.doc2md` subsystem on this machine. No Accessibility or Automation permission is required.

The smoke refuses to run if a `doc2md` process is already running. Its cleanup path quits the app on exit, and killing a pre-existing session could lose unsaved work. Quit any running `doc2md` (including older builds) before invoking the smoke.

The smoke quits the `doc2md` app it launched before exit and falls back to killing that binary if graceful quit cannot complete. Cleanup only runs for the instance this script started. This is a local developer tool and does not run in CI.

## Manual Validation

Use these checks for this phase:

1. `npm test -- --run` passes.
2. `npm run build` succeeds and keeps hosted browser asset behavior.
3. `npm run build:desktop` succeeds and `dist/index.html` uses relative asset paths.
4. Debug app launches with `npm run dev` running and displays the React app.
5. Debug app shows the missing-dev-server error when `npm run dev` is stopped.
6. Release build launches without the Vite dev server and logs `app ready: true`.
7. Open a Markdown file, edit it, save it, reveal it in Finder, and verify conflict and permission-needed UI paths.
8. Open a supported non-Markdown source file, confirm it converts into Markdown, Save As to `.md`, and verify subsequent saves update only the chosen Markdown target.

If full Xcode is not available, record that the Mac app build and launch checks were not run. The command line tools package alone is not enough; `xcodebuild` must point at a full Xcode developer directory.
