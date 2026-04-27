# doc2md Mac Shell

This is the Mac-only shell for `doc2md.app`. It is a minimal Swift + SwiftUI + `WKWebView` app that displays the existing React UI, edits `.md` files directly, imports every other supported source format into Markdown through the shared web converters, and includes Sparkle update plumbing.

Out of scope for this phase: persisted security-scoped bookmarks, recent files, autosave, and asset persistence.

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

This is an unsigned local build. Signed, notarized, DMG-packaged release artifacts are produced by the protected Phase 5c release workflow.

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

## Sparkle Plumbing

The Mac app links Sparkle 2 through Swift Package Manager and starts `SPUStandardUpdaterController` at launch. Automatic checks and automatic updates are disabled in `Info.plist`, so normal Debug and local Release launches do not contact production infrastructure. The committed `SUFeedURL` is loopback-only:

```text
http://127.0.0.1:47654/appcast.xml
```

For local validation, the app supports a process environment override:

```bash
DOC2MD_SPARKLE_FEED_URL="http://127.0.0.1:47654/appcast.xml" \
  .build/mac/Build/Products/Release/doc2md.app/Contents/MacOS/doc2md
```

Serve the fixture appcast from the fixture directory:

```bash
cd apps/macos/doc2mdTests/Fixtures/Sparkle
python3 -m http.server 47654 --bind 127.0.0.1
```

Then launch the app with the environment override above and choose `doc2md > Check for Updates...`. The fixture advertises version `99.0` / build `9900`, which is newer than the local app version and should trigger Sparkle's standard update UI. The fixture uses a placeholder enclosure and signature for detection-only validation; the protected release workflow produces signed update archives and production appcasts.

Offline launch validation: stop the fixture server, launch the app normally, and confirm the window appears without Sparkle errors. Because automatic checks are disabled, Sparkle should not block launch or show update UI unless the menu item is used.

The committed Sparkle public key is:

```text
J7tl4vxYjEBbgB7HtuEteKnmv8rENwZnd7J1ThklvBs=
```

This is the production `SUPublicEDKey`. The matching private EdDSA key must be stored only as the `SPARKLE_EDDSA_PRIVATE_KEY` secret in the protected `mac-release` GitHub Environment. It must not be committed, logged, or passed on a command line.

It was generated as an Ed25519 public key by extracting the raw 32-byte public key and base64-encoding it:

```bash
tmpdir="$(mktemp -d)"
openssl genpkey -algorithm Ed25519 -out "$tmpdir/doc2md-sparkle-test-private.pem"
openssl pkey -in "$tmpdir/doc2md-sparkle-test-private.pem" -pubout -outform DER | tail -c 32 | openssl base64 -A
rm -rf "$tmpdir"
```

Only the public key is committed. To rotate the key, generate a new Sparkle key pair with Sparkle's `generate_keys`, ship a transition release that can trust the new public key, update `SUPublicEDKey`, and retire the old private key from the protected Environment after the transition is complete.

## Protected Release Workflow

Phase 5c adds [`.github/workflows/release-mac.yml`](../../.github/workflows/release-mac.yml). It runs only for canonical semver tags (`vX.Y.Z`) or a manual `workflow_dispatch` that names an existing canonical tag in `KjellKod/doc2md`. Secret-bearing jobs use the protected `mac-release` Environment.

Required `mac-release` Environment secrets:

- `APPLE_DEVELOPER_ID_APPLICATION_P12`: base64-encoded Developer ID Application `.p12`.
- `APPLE_DEVELOPER_ID_APPLICATION_P12_PASSWORD`: password for the `.p12`.
- `APPLE_NOTARY_API_KEY_P8`: App Store Connect notary API private key, either raw PEM or base64-encoded PEM.
- `APPLE_NOTARY_API_KEY_ID`: App Store Connect API key ID.
- `APPLE_NOTARY_API_ISSUER_ID`: App Store Connect issuer ID.
- `SPARKLE_EDDSA_PRIVATE_KEY`: Sparkle EdDSA private key matching the committed `SUPublicEDKey`.

Apple signing/notarization secrets and Sparkle signing secrets are intentionally consumed by separate workflow jobs. Normal PRs and forks use the unsigned [Mac PR check](../../.github/workflows/mac-pr-check.yml) and cannot access the release Environment.

Credential reuse guidance:

- Apple Developer ID credentials may be reused from another app if both apps are owned by the same Apple Developer team and the maintainer is comfortable with the shared signing identity. A Developer ID Application certificate identifies the developer/team, not a single app.
- Apple notary API credentials may also be reused from the same Apple Developer team, but a separate App Store Connect API key per repository is cleaner for audit, revocation, and blast-radius control.
- Do not reuse another app's Sparkle EdDSA private key for `doc2md`. Generate a distinct Sparkle key pair for this app, commit only the matching `SUPublicEDKey`, and store only the private key text in the `SPARKLE_EDDSA_PRIVATE_KEY` Environment secret.
- If the Sparkle private key does not match the committed `SUPublicEDKey`, Sparkle update verification will fail.

Open-source PR safety rules:

- Keep Apple and Sparkle secrets scoped only to the protected `mac-release` GitHub Environment, not repository-level secrets that every workflow can reference.
- Require reviewers on the `mac-release` Environment so release jobs pause before secrets are exposed.
- Do not add `pull_request_target` workflows. The repository security guard rejects this.
- Do not reference Apple or Sparkle secrets from any `pull_request` workflow. PR and fork checks must stay no-secret.
- Do not check out PR head code in any job that can access release secrets. The release workflow checks out a resolved canonical tag SHA.
- Keep Apple signing/notarization and Sparkle update signing in separate jobs so one secret family is never present with the other.
- Run `python3 scripts/security_ci_guard.py` after workflow changes; it checks for `pull_request_target`, PR workflows that reference release secrets, release-secret jobs without environment gates, mixed Apple/Sparkle secret jobs, and possible committed private-key material.

Before tagging a release, manually bump both Xcode build settings in `apps/macos/doc2md.xcodeproj/project.pbxproj`:

- `MARKETING_VERSION` must match the tag without the leading `v`.
- `CURRENT_PROJECT_VERSION` must be numeric and strictly greater than the latest published appcast's `sparkle:version`.

The initial `0.1.0` release may use `CURRENT_PROJECT_VERSION = 1`; later releases must not reuse build `1`.

Local non-secret dry run:

```bash
npm run build:desktop
bash scripts/build-mac-app.sh --configuration Release
VERSION=0.1.0 RELEASE_DRY_RUN=1 APP_PATH=.build/mac/Build/Products/Release/doc2md.app bash scripts/release/sign_mac_app.sh
VERSION=0.1.0 RELEASE_DRY_RUN=1 APP_PATH=.build/mac/Build/Products/Release/doc2md.app bash scripts/release/notarize_mac_app.sh
VERSION=0.1.0 RELEASE_DRY_RUN=1 APP_PATH=.build/mac/Build/Products/Release/doc2md.app bash scripts/release/package_mac_dmg.sh
VERSION=0.1.0 APP_PATH=.build/mac/Build/Products/Release/doc2md.app bash scripts/release/package_sparkle_zip.sh
VERSION=0.1.0 RELEASE_DRY_RUN=1 ZIP_PATH=.build/release/doc2md-0.1.0.zip bash scripts/release/sign_sparkle_zip.sh
python3 scripts/release/generate_appcast.py --version 1 --short-version 0.1.0 --enclosure-url "https://github.com/KjellKod/doc2md/releases/download/v0.1.0/doc2md-0.1.0.zip" --enclosure-length 100 --ed-signature DRY_RUN_SIGNATURE | xmllint --noout -
```

Protected release dispatch:

```bash
gh workflow run release-mac.yml -f tag=v0.1.0
```

Approve the `mac-release` Environment gate in GitHub Actions. The workflow signs and notarizes `doc2md.app`, staples the ticket, creates `doc2md-<version>.dmg`, creates and EdDSA-signs `doc2md-<version>.zip`, generates `appcast.xml`, creates the GitHub Release if needed, and uploads all three assets with `--clobber` for idempotent reruns.

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
9. Serve `apps/macos/doc2mdTests/Fixtures/Sparkle/appcast.xml`, launch with `DOC2MD_SPARKLE_FEED_URL`, and confirm `Check for Updates...` detects the fixture update.
10. Stop the fixture server, launch again, and confirm offline launch is not blocked by Sparkle.

If full Xcode is not available, record that the Mac app build and launch checks were not run. The command line tools package alone is not enough; `xcodebuild` must point at a full Xcode developer directory.
