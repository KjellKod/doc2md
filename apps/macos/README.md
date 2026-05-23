# doc2md Mac Shell

This is the Mac-only shell for `doc2md.app`. It is a minimal Swift + SwiftUI + `WKWebView` app that displays the existing React UI, edits `.md` files directly, imports every other supported source format into Markdown through the shared web converters, remembers opt-in desktop metadata, and includes Sparkle update plumbing.

Out of scope for this phase: persisted security-scoped bookmarks, autosave, and asset persistence.

## Desktop Capabilities

- `window.doc2mdShell.version === 2` is injected into the `WKWebView` at document start.
- The bridge exposes `openFile`, `saveFile`, `saveFileAs`, `revealInFinder`, `statFile`, `getPersistenceSettings`, `setPersistenceEnabled`, `setPersistenceTheme`, and `clearRecentFiles`.
- Open reads `.md` and `.markdown` files directly, preserving LF/CRLF metadata for later saves.
- Open imports every other supported format, including `.txt`, `.json`, `.csv`, `.tsv`, `.html`, `.docx`, `.xlsx`, `.pdf`, and `.pptx`, through a one-shot native handoff back into the existing web conversion pipeline.
- First save for an imported document always goes through `Save As` to a chosen `.md` target. After that, Cmd+S updates the chosen Markdown file with the same mtime conflict detection used for directly opened `.md` files.
- Save writes through a sibling temp file and `FileManager.replaceItemAt`, with mtime conflict detection. Save targets must use the `.md` extension.
- Save As uses `NSSavePanel`; Reveal in Finder uses `NSWorkspace`.
- `statFile` returns path and modification-time metadata for an already opened Markdown path only. It does not read document bytes and does not add file watching or background polling.
- Current-session security-scoped URLs are retained in memory only.
- Desktop settings can enable local persistence for the Day/Night theme and recent-file metadata, clear recent history, and retry opening recent files.
- File menu commands dispatch `doc2md:native-new`, `doc2md:native-open`, `doc2md:native-save`, `doc2md:native-save-as`, `doc2md:native-reveal-in-finder`, and `doc2md:native-close-window` into the webview.
- Standard Edit actions remain on the AppKit and `WKWebView` responder chain.
- Embedded images and other source-document assets are dropped, matching the hosted web product.

## Desktop Persistence

The settings popover is rendered only when the version-2 Mac bridge is available. Hosted web builds do not show the control and do not read or write browser storage for this feature.

When `Persistence` is enabled, the native shell writes a small JSON file under the app's Application Support directory. The file contains only:

- `persistenceEnabled`
- optional `theme` (`light` or `dark`)
- up to 10 `recentFiles` metadata rows (`path`, `displayName`, and `lastOpenedAt`)

Recent files are recorded in the settings file and through the app's recent-document controller after successful native Markdown open, source import open, Save, or Save As operations with a real path. Paths are standardized, deduped newest-first, and capped at 10 before they are exposed to the web UI. Clicking a recent row asks the native shell to reopen that exact path; if the file is missing or no longer reachable, the row stays in history and is marked unavailable until a later retry succeeds. `Clear history` removes the recent-file list and automatic session restore for currently open files without disabling persistence or closing the current editor; explicit Open, Save, or Save As records the path again.

Disabling `Persistence` deletes the settings file and returns the app to the disabled/default persistence snapshot. No document contents, imported bytes, credentials, signing material, release secrets, license data, or payment data are stored.

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

## App Icon

The app icon is provided by the native Xcode asset catalog at:

```text
apps/macos/doc2md/Resources/Assets.xcassets/AppIcon.appiconset
```

The committed source export is:

```text
apps/macos/doc2md/Resources/AppIconSource/doc2md-icon-1024.png
```

To replace the icon, export a new 1024x1024 PNG to that source path, then regenerate the required macOS slots from the repo root:

```bash
bash scripts/generate-mac-icons.sh
```

The script uses macOS `sips` and writes the full macOS `AppIcon` slot set: 16, 32, 64, 128, 256, 512, and 1024 pixel outputs through the standard `16x16`, `32x32`, `128x128`, `256x256`, and `512x512` `1x`/`2x` asset catalog entries.

Xcode consumes the icon through `Resources/Assets.xcassets`, which is registered in `apps/macos/doc2md.xcodeproj` and included in the `doc2md` target's Copy Bundle Resources phase. The target build setting `ASSETCATALOG_COMPILER_APPICON_NAME` must remain `AppIcon` for Debug and Release. Do not add `Resources/AppIconSource` to the project; it is design-source-only and should not be bundled into `doc2md.app`.

After a Release build, the compiled app should contain:

```text
.build/mac/Build/Products/Release/doc2md.app/Contents/Resources/AppIcon.icns
```

## Release-Style Local Build

Build the Release configuration with Xcode:

```bash
xcodebuild -project apps/macos/doc2md.xcodeproj -scheme doc2md -configuration Release build
```

Release-style builds run the Xcode `Build Desktop Web Bundle` phase before Copy Bundle Resources. That phase runs `npm run build:desktop` and copies `dist/` into `apps/macos/doc2md/Resources/Web/`, which is bundled as `Web/index.html` inside the app.

The same target bundles `apps/macos/THIRD_PARTY_NOTICES.md` into `doc2md.app/Contents/Resources/THIRD_PARTY_NOTICES.md`. Public DMGs and other release artifacts must keep that notice file or a generated equivalent for the exact released artifact.

The app also bundles:

- `LICENSES/LicenseRef-doc2md-Desktop.txt` as `doc2md.app/Contents/Resources/LicenseRef-doc2md-Desktop.txt` for compliance. The desktop product license is surfaced from the About panel's Licenses window through the `doc2md Desktop License` action, and remains distinct from the purchased-license status window under Help.
- `apps/macos/doc2md/Resources/Credits.rtf` remains bundled for historical reasons. The About panel is now an app-owned SwiftUI window (see below), so Credits.rtf is no longer the primary attribution surface.

## About Panel and Third-Party Licenses

`doc2md → About doc2md` opens a custom app-owned About window that shows the app icon, the `doc2md` name, a short description, the `CFBundleShortVersionString` version, the `CFBundleVersion` build, and the 7-character release commit. The About window has three buttons:

- `Docs` opens `https://github.com/KjellKod/doc2md#readme` in the user's default browser via `NSWorkspace.shared.open`.
- `GitHub` opens `https://github.com/KjellKod/doc2md` in the user's default browser via `NSWorkspace.shared.open`.
- `Licenses` opens a native, read-only window titled `Third-Party Licenses` whose body is the bundled `apps/macos/THIRD_PARTY_NOTICES.md` content with the leading top-heading line stripped so the synthetic `Third-Party Licenses` title is the only top heading. The body is selectable and scrollable, and the same window provides a `doc2md Desktop License` action for the bundled desktop product license text.

The release commit is provided by `apps/macos/doc2md/ReleaseCommit.generated.swift`, which is gitignored and regenerated by `scripts/generate-release-commit.mjs` at every Mac build and at Vitest setup. The generator first reads `DOC2MD_RELEASE_COMMIT` (CI override), then falls back to `git rev-parse --short=7 HEAD`, then to the literal `unknown` if neither is available.

Help-menu third-party items have been removed: there is no longer an `Acknowledgments…` item or a third-party `License…` item under Help. The third-party notices source of truth remains the bundled `apps/macos/THIRD_PARTY_NOTICES.md`, surfaced through the About panel's `Licenses` button. The app's own desktop product license is also surfaced from that licensing surface, not from Help.

The Help menu now hosts the licensing/status workflow items (relocated from the `doc2md` app menu): `Enter License...`, a `Monthly Update Checks` toggle, and `Check for Updates...`.

Notice inventory maintenance:

- Generate: `npm run generate:notices`
- Verify drift: `npm run generate:notices:check` (also enforced by `npm test -- --run`)
- Dev/default output keeps repository links pinned to `https://github.com/KjellKod/doc2md/blob/main/...`.
- Release output can pin repository links to a tag or ref without editing the committed notice file:
  `DOC2MD_RELEASE_REF=v2.2.2 npm run generate:notices -- --output "$(mktemp -d)/THIRD_PARTY_NOTICES.md"`.
- Drift checks always compare the committed default `main` output, even if `DOC2MD_RELEASE_REF` is present in the shell.
- npm algorithm note: the generator walks the production dependency closure (root + workspace `dependencies`, excluding `devDependencies`) via installed `node_modules/*/package.json` and follows transitive `dependencies`.

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

The script first checks that `apps/macos/doc2md/SupportedFormats.generated.swift` is up to date, then runs `npm run generate:notices`, runs `npm run build:desktop`, invokes `xcodebuild` with `-derivedDataPath .build/mac`, and runs a positive native file API allowlist scan across `apps/macos/doc2md/*.swift`. When `DOC2MD_RELEASE_REF` is set, the script generates a release-pinned notice file to a temporary path, stages it only for Xcode's resource copy, then restores and verifies the committed `apps/macos/THIRD_PARTY_NOTICES.md` before exiting. It writes the app to:

```text
.build/mac/Build/Products/Release/doc2md.app
```

The final output line is:

```text
Built: <absolute path to .build/mac/Build/Products/Release/doc2md.app>
```

PR-time CI does not build the Mac app or DMG. The full local validation command runs the ordinary web/test/security checks and then runs Mac validation by default:

```bash
npm run validate:local
```

`npm run validate:local -- --signed` is equivalent and can be used when you want the command itself to state that signed Mac validation is required.

Use `npm run validate:local -- --skip-mac` only when Mac validation is intentionally out of scope. Maintainers can run the Mac-only validation command directly when debugging desktop, DMG, signing/notarization, Sparkle, or desktop-specific release paths:

```bash
npm run validate:mac
```

The default validation command requires local Apple/Sparkle credentials and fails loudly when they are missing. Use `npm run validate:mac -- --unsigned-only` only for contributor machines or reduced smoke checks where signed/notarized validation is intentionally deferred to a maintainer.

This is an unsigned local build. Signed, notarized, DMG-packaged release artifacts are produced by the protected Phase 5c release workflow.

If `xcode-select -p` points at `/Library/Developer/CommandLineTools`, the helper tries `/Applications/Xcode.app/Contents/Developer` and fails with a full-Xcode error if that developer directory is unavailable. Install full Xcode and select it:

```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
```

## One-Command DMG Build

Build a local unsigned DMG from the repo root:

```bash
npm run build:dmg
```

This is the local smoke path. The command builds the Release `.app`, derives the version automatically from the repo's release-version helper, renders the drag-to-Applications DMG layout headlessly with pinned `dmgbuild`, runs a mandatory DMG mount self-test for `doc2md.app`, `Applications`, `.DS_Store`, and `.background.png`, and writes:

```text
.build/release/doc2md-<version>.dmg
```

Dirty or unreleased local builds use a `-dev` version suffix. To force a specific local filename for a smoke test:

```bash
npm run build:dmg -- --version 0.1.0
```

This local DMG is unsigned and unnotarized unless you pass `--signed` with a valid `CODESIGN_IDENTITY` already available. Local dry-run and release packaging both use the same headless `dmgbuild` layout path; missing `dmgbuild`, invalid JSON settings, missing `.DS_Store`, or background mismatches are blocking failures. If `dmgbuild` is missing, install the pinned release tool from the repo root (macOS system Python is PEP 668-managed, so install `pipx` via Homebrew first):

```bash
brew install pipx
pipx install "dmgbuild==1.6.7" --pip-args "--constraint $PWD/requirements-mac-release.txt"
```

Public release DMGs should come from the protected release workflow so signing, notarization, stapling, Sparkle ZIP signing, appcast generation, and asset upload happen together.

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

The Mac app links Sparkle 2 through Swift Package Manager and starts `SPUStandardUpdaterController` at launch. Update checks are separate from license enforcement and never block open, edit, convert, save, or export. The committed `SUFeedURL` is loopback-only:

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

Offline launch validation: stop the fixture server, launch the app normally, and confirm the window appears without Sparkle errors. Sparkle should not block launch, document operations, or license state changes if an update check fails.

Unlicensed, invalid, and license-check-failed users get discreet automatic checks with no opt-out. Licensed users get frequent automatic checks by default and can enable a persisted `Monthly Update Checks` menu toggle to use a no-more-than-monthly cadence. The toggle does not mutate license state. Manual `Check for Updates...` remains available.

Production update hosting target: `updates.doc2md.dev` should be the stable public Sparkle appcast host once DNS and release hosting are configured. GitHub Releases can continue storing versioned DMG/ZIP/appcast artifacts behind that public domain.

The committed Sparkle public key is:

```text
cPKRRdnlQyTV2KNbvVoXz/Y6gZZDFr6WTbo2loWNWB8=
```

This is the production `SUPublicEDKey`. The matching private EdDSA key is stored only as the `SPARKLE_EDDSA_PRIVATE_KEY` secret in the protected `mac-release` GitHub Environment. It must not be committed, logged, or passed on a command line.

The keypair was generated with Sparkle's own `generate_keys` tool, which stores the private Ed25519 key in the macOS Keychain on the maintainer's machine and prints the public key for embedding:

```bash
.build/mac/SourcePackages/artifacts/sparkle/Sparkle/bin/generate_keys
# Prints the public key. Private key is now in your login Keychain.

# Export the private key once to send to the GitHub Environment secret.
# Use stdin redirection so the key is never passed as a command-line
# argument (process arguments are visible in `ps` output).
.build/mac/SourcePackages/artifacts/sparkle/Sparkle/bin/generate_keys -x sparkle-private.pem
gh secret set SPARKLE_EDDSA_PRIVATE_KEY --env mac-release < sparkle-private.pem
rm -P sparkle-private.pem
```

Only the public key is committed. To rotate the key, generate a new Sparkle key pair with `generate_keys` on a fresh maintainer machine, ship a transition release that can trust the new public key, update `SUPublicEDKey`, push the new private key to the `mac-release` Environment secret, and retire the old private key after the transition is complete. Back up the private key (e.g., to a password manager) so it is recoverable if the Keychain is lost.

## Local Signed Release (Maintainer Only)

For end-to-end validation of the Mac desktop pipeline before tagging or merging Mac-sensitive changes, maintainers should run the full local gate:

```bash
npm run validate:local
```

That command runs lint, typecheck, unit tests, production build, Playwright e2e, Python unit tests, workflow/security guard, and then the Mac validation wrapper. The Mac validation wrapper runs the unsigned app launch smoke, unsigned DMG mount test, DMG determinism check, Sparkle ZIP/appcast generation, and the signed/notarized local release path from [`scripts/release/release_mac_local.sh`](../../scripts/release/release_mac_local.sh). The full signing/notarization prerequisites, environment variables, and licensing constraints live in [`docs/runbooks/release-mac-local.md`](../../docs/runbooks/release-mac-local.md). Locally signed builds are for evaluation and debugging only; distribution requires using the protected release workflow below.

## Protected Release Workflow

Phase 5c adds [`.github/workflows/release-mac.yml`](../../.github/workflows/release-mac.yml). It runs only for canonical semver tags (`X.Y.Z`) or a manual `workflow_dispatch` that names an existing canonical tag in `KjellKod/doc2md`. Secret-bearing jobs use the protected `mac-release` Environment.

Required `mac-release` Environment secrets:

- `APPLE_DEVELOPER_ID_APPLICATION_P12`: base64-encoded Developer ID Application `.p12`.
- `APPLE_DEVELOPER_ID_APPLICATION_P12_PASSWORD`: password for the `.p12`.
- `APPLE_NOTARY_API_KEY_P8`: App Store Connect notary API private key, either raw PEM or base64-encoded PEM.
- `APPLE_NOTARY_API_KEY_ID`: App Store Connect API key ID.
- `APPLE_NOTARY_API_ISSUER_ID`: App Store Connect issuer ID.
- `SPARKLE_EDDSA_PRIVATE_KEY`: Sparkle EdDSA private key matching the committed `SUPublicEDKey`.

Apple signing/notarization secrets and Sparkle signing secrets are intentionally consumed by separate workflow jobs. Normal PRs and forks do not run cloud macOS build jobs; maintainers run local Mac validation before merge when a PR touches Mac-sensitive paths.

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

## Licensing MVP

Phase 7 adds Mac-only honest-user licensing. The app remains free to keep using when unlicensed; a valid paid license removes occasional reminders. Hosted web remains free, stateless, and independent at `https://kjellkod.github.io/doc2md/`.

The MVP license states are `Unlicensed`, `Licensed`, `Invalid`, and `License Check Failed`. There is no time-limited access state. License verification is local Ed25519 public-key verification over `doc2md-license-v1.<base64url-json-claims>`. The private signing key, merchant credentials, webhook secrets, customer records, Apple secrets, and Sparkle private key must not be committed or exposed to PR CI.

License storage is local and non-syncing: Keychain is primary and Application Support is fallback. Conflict resolution verifies candidates first, then applies storage priority, so invalid Keychain data never deletes the only valid Application Support fallback. When a valid fallback repairs invalid Keychain data, doc2md deletes the fallback only after verifying Keychain can be read back as the same valid token. If Keychain write or read-back verification fails, including a different valid token after the repair attempt, the app stays licensed from the fallback and keeps it in place.

The `Enter License...` menu item opens local paste-token activation. The Mac-only `Buy License` affordance is disabled and says purchases are not live yet; it must not open `doc2md.dev/buy` or any checkout until a later launch change enables purchases. Before taking money, maintainers must assign merchant account ownership, tax/sales responsibility, refund/support workflow ownership, license delivery ownership, and explicit go-live approval.

Unlicensed reminders are save-count based in the current startup session: after successful save 10, then 35, 60, and so on. Failed, cancelled, conflicted, open, edit, import, conversion, and export actions do not count, and reminders are shown only after save completion returns control to the app.

The Mac build helper passes the release helper's computed marketing version into `xcodebuild`, so `CFBundleShortVersionString` does not rely on the stale Xcode project default during scripted builds. Before tagging a release, manually bump the remaining numeric Xcode build setting in `apps/macos/doc2md.xcodeproj/project.pbxproj`:

- `CURRENT_PROJECT_VERSION` must be numeric and strictly greater than the latest published appcast's `sparkle:version`.

The initial `0.1.0` release may use `CURRENT_PROJECT_VERSION = 1`; later releases must not reuse build `1`.

Before a signed public release, verify that the notice file shipped inside the `.app` and DMG covers the exact released artifact. JavaScript dependencies come from `package-lock.json`, native SwiftPM/Xcode dependencies come from Package.resolved/project metadata, and doc2md repository links are pinned automatically when the build receives a release ref. For example:

```bash
DOC2MD_RELEASE_REF=v2.2.2 bash scripts/build-mac-app.sh --configuration Release
```

`scripts/build-mac-dmg.sh --version v2.2.2` passes that version through as `DOC2MD_RELEASE_REF` when the environment variable is not already set. No release process should manually edit `apps/macos/THIRD_PARTY_NOTICES.md` from `main` to a tag.

Local unsigned DMG smoke:

```bash
npm run build:dmg
```

The lower-level release scripts remain available for CI and targeted signing/notarization debugging, but day-to-day DMG creation should use the one-command wrapper.

Protected release dispatch:

```bash
gh workflow run release-mac.yml -f tag=v0.1.0
```

Approve the `mac-release` Environment gate in GitHub Actions. The workflow signs and notarizes `doc2md.app`, staples the app ticket, packages the polished `doc2md-<version>.dmg` with pinned headless `dmgbuild`, signs and notarizes the DMG, staples and validates the DMG ticket, creates and EdDSA-signs `doc2md-<version>.zip`, generates `appcast.xml`, creates the GitHub Release if needed, and uploads all three assets with `--clobber` for idempotent reruns. If DMG packaging fails, use the [DMG packaging failure runbook](../../docs/runbooks/dmg-packaging-failure.md).

Release artifact validation commands (signed-DMG path only). Set `VERSION` to your build version first (literal `<version>` would be parsed as shell input redirection). **Do not run these against the unsigned local `npm run build:dmg` output** — `codesign --verify` will correctly report `code object is not signed at all` because the local dry-run build is intentionally unsigned. The commands below assume a signed DMG produced by the protected `release-mac.yml` workflow above (or by a local signed run via `scripts/release/release_mac_local.sh` with a Developer ID certificate):

```bash
VERSION="0.1.0"  # replace with your release version
codesign --verify --deep --strict --verbose=2 /Applications/doc2md.app
spctl --assess --type execute --verbose=4 /Applications/doc2md.app
xcrun stapler validate /Applications/doc2md.app
codesign --verify --strict --verbose=2 ".build/release/doc2md-${VERSION}.dmg"
xcrun stapler validate ".build/release/doc2md-${VERSION}.dmg"
spctl --assess --type open --context context:primary-signature --verbose=4 ".build/release/doc2md-${VERSION}.dmg"
hdiutil attach ".build/release/doc2md-${VERSION}.dmg"
hdiutil detach "/Volumes/doc2md ${VERSION}"
```

The DMG background source lives at `apps/macos/dmg/doc2md-dmg-background.png`. `dmgbuild` copies it into the mounted volume as `.background.png`; it is not bundled into the Xcode target and should not exist at:

```text
.build/mac/Build/Products/Release/doc2md.app/Contents/Resources/doc2md-dmg-background.png
```

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
11. `npm run validate:local` passes on a maintainer Mac with Apple/Sparkle credentials. If credentials are intentionally unavailable, `npm run validate:local -- --unsigned-only` passes and the signed local validation remains pending for a maintainer.
12. `test -f apps/macos/dmg/doc2md-dmg-background.png && test ! -e .build/mac/Build/Products/Release/doc2md.app/Contents/Resources/doc2md-dmg-background.png` passes after a Release build.

If full Xcode is not available, record that the Mac app build and launch checks were not run. The command line tools package alone is not enough; `xcodebuild` must point at a full Xcode developer directory.
