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
| 1. Mac Shell Scaffold | done | PR #77 | Add `apps/macos/`, Xcode shell, desktop web bundle path, Debug/Release loading. | Phase 2 |
| 2. Bridge and React Desktop Mode | done | PR #78 (`mac-phase2-bridge_2026-04-21__0712`) | Add bridge types, mock shell, native menu events, desktop save-state plumbing. | Phase 3 |
| 2.5. Developer Mac Build Helper | active | `mac-build-smoke_2026-04-21__2246` | One-command local `.app` build with a fixed output path and a README pointer so manual testing is predictable. | Smooths Phase 3+ manual smoke |
| 3. Markdown File Persistence | planned | TBD | Implement open/save/save-as for Markdown with atomic replace, mtime conflicts, line endings, Finder reveal. | Phase 4 |
| 4. Converted Document and Asset Persistence | planned | TBD | Save converted output with `name.assets/` folder semantics and session-owned asset rewrites. | Phase 5 |
| 5. Distribution and Updates | planned | TBD | Add Sparkle, DMG install, ZIP updates, signing/notarization docs, macOS CI build + sign + notarize workflow, and release scripts. | MVP ship |

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

## Phase 2.5: Developer Mac Build Helper

Goal:

Make local `.app` builds predictable and discoverable for manual smoke testing, without blocking on Phase 5 release infrastructure.

Expected changes:

- Add `scripts/build-mac-app.sh` that:
  - Detects a usable `DEVELOPER_DIR` (prefers `/Applications/Xcode.app/Contents/Developer` when `xcode-select -p` points at Command Line Tools).
  - Runs `npm run build:desktop`.
  - Runs `xcodebuild -project apps/macos/doc2md.xcodeproj -scheme doc2md -configuration <cfg> -derivedDataPath .build/mac build`.
  - Prints a single final line like `Built: .build/mac/Build/Products/<Configuration>/doc2md.app`.
- Add an `npm run build:mac` alias that calls the script.
- Add `.build/` to `.gitignore`.
- Update `apps/macos/README.md` with:
  - The one-command workflow.
  - The resolved `.app` path and how to open it (`open .build/mac/Build/Products/Release/doc2md.app`).
  - A note that this produces an unsigned local build; signed/notarized artifacts come from Phase 5 CI.
- No signing, notarization, packaging, or CI integration in this phase.

Acceptance criteria:

- `npm run build:mac` produces `.build/mac/Build/Products/Release/doc2md.app` on a host with Xcode installed.
- The script fails clearly on hosts with only Command Line Tools and no `Xcode.app`.
- The README points new contributors to the exact command and output path.

Out of scope (deferred to Phase 5):

- Signing, notarization, DMG, Sparkle, appcast, CI macOS job.

Validation:

- Run `npm run build:mac` locally. Confirm the `.app` exists at the printed path and launches.
- Confirm no changes to the hosted browser build or the existing `build:desktop` output.

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

Make the Mac app installable and updateable outside the App Store, with a secure CI release pipeline that does not leak Apple or Sparkle secrets.

Expected changes:

- Add Sparkle 2 integration.
- Add `SUFeedURL`, `SUPublicEDKey`, production appcast, and beta appcast.
- Use DMG for first install.
- Use ZIP of the `.app` bundle for Sparkle updates.
- Document and script release steps for Developer ID signing, hardened runtime, notarization, stapling, Sparkle signing, and appcast generation.
- Keep Apple notarization credentials separate from Sparkle EdDSA keys.

### CI Release Workflow (macos-latest)

Add a new workflow (for example `.github/workflows/release-mac.yml`) that builds, signs, notarizes, and packages the Mac app. It does NOT run on every PR and does NOT run on forks.

- Triggers: `push` on a semver release tag (for example `v*`) plus `workflow_dispatch` with required reviewers. Never trigger signing from `pull_request` or `pull_request_target`. Forked-PR events do not receive secrets; CI still runs the no-secrets build checks on PRs (see below).
- Jobs, each minimal and isolated:
  1. `build`: `macos-latest`, no secrets, runs `npm run build:desktop` + `xcodebuild -configuration Release` + `swiftc -parse` + the forbidden-API grep. Uploads the unsigned `.app` as a job artifact.
  2. `sign-and-notarize`: `macos-latest`, consumes the `build` artifact, targets a protected GitHub Environment (for example `mac-release`) with required reviewers. This is the only job that touches secrets.
  3. `package`: builds the DMG and the Sparkle update ZIP from the signed artifact, signs the ZIP with the EdDSA key in a separate step, and updates the appcast.
  4. `publish`: publishes the DMG and appcast to the release target (GitHub Release assets or the appcast host). Read-only `GITHUB_TOKEN` permissions by default; widen only for the specific publish step.
- Also add a macOS PR check (separate workflow, no secrets, `pull_request` trigger) that runs `npm run build:desktop`, `xcodebuild build` in an unsigned Release config, `swiftc -parse`, and the forbidden-API grep. This closes the CI gap for Mac-only code without ever exposing signing credentials.

### Secrets Handling Rules (binding)

- All Apple and Sparkle secrets live only in GitHub Encrypted Secrets scoped to the `mac-release` protected Environment. Never in the repo, never in Actions variables, never in logs.
- Minimum secret set and intended use:
  - `APPLE_DEVELOPER_ID_CERT_P12` (Base64 of the `.p12` Developer ID Application cert). `APPLE_DEVELOPER_ID_CERT_PASSWORD` (password for the `.p12`).
  - `APPLE_NOTARY_API_KEY_ID`, `APPLE_NOTARY_API_ISSUER_ID`, `APPLE_NOTARY_API_KEY_P8` (Base64 of the App Store Connect API key) — used by `xcrun notarytool`.
  - `SPARKLE_EDDSA_PRIVATE_KEY` (Base64 of the EdDSA private key) — used only by `sign_update`.
  - `SPARKLE_EDDSA_PUBLIC_KEY` — committed as `SUPublicEDKey` in `Info.plist`, NOT stored as a secret.
- Keychain handling in CI:
  - Create a per-job temporary keychain with `security create-keychain`; never touch the runner default keychain.
  - Import the cert with `-T /usr/bin/codesign -T /usr/bin/security`, set a short timeout, and delete the keychain on job exit even on failure.
- Process hygiene:
  - Never pass secrets on command lines where they can land in logs. Prefer `--password-env` style flags or stdin.
  - `actions/runner` already masks known secrets, but also `set +x` in any custom bash that could accidentally echo.
  - Pin every third-party action by full SHA (repo convention from the CI trustworthiness work). No `@v1` or `@main` tags.
  - Limit `permissions:` per job. Only the `publish` job writes to Releases.
- Protection layers on top of the Environment:
  - Required reviewers on the `mac-release` Environment so a human approves each signed build.
  - Required branch / tag patterns so signing cannot run off an arbitrary branch.
  - Never run signing on `pull_request_target` and never check out PR code into a signing job.
- Rotation and key custody:
  - Document a yearly rotation for the Developer ID cert and the App Store Connect API key.
  - Document EdDSA key rotation steps (generate new key, ship appcast transition with both public keys temporarily accepted, retire old key).
  - Keep Apple credentials and Sparkle EdDSA keys in separate secret entries and separate jobs so a compromise of one does not imply a compromise of the other.
- Threat model notes to keep in the release runbook:
  - Fork PRs cannot reach secrets by design; still, do not execute PR-provided code in any workflow with secrets scope.
  - A malicious dependency bumping a signing job's script path must be blocked by pinned SHAs, vendored scripts, and `permissions: write-none` defaults.
  - Verify signatures on Sparkle updates (EdDSA) and the DMG (notarization staple) during local and release dry runs.

Acceptance criteria:

- App installs from a DMG and launches on macOS 13+.
- Signed/notarized/stapled app passes local validation (`spctl --assess --type exec`).
- Sparkle can detect a newer signed update from a test appcast.
- Offline launch does not block on update checks.
- Release CI workflow runs on tag push only, requires Environment approval, and never exposes secrets to PR or forked workflows.
- Mac PR check workflow catches broken Swift or broken desktop bundles without signing.
- No secret has ever appeared in repo history, workflow YAML, or logs.

Validation:

- Manual DMG install.
- Manual offline launch.
- Manual Sparkle update check against test appcast.
- Release dry run using local or test credentials where possible.
- CI dry run: push a release tag on a throwaway branch pattern; confirm Environment approval gate blocks unapproved signing and that the published artifacts verify with `codesign --verify` and Sparkle `sign_update --verify`.
- Secret audit: grep the repo history for known key fragments and confirm only public values (like `SUPublicEDKey`) are committed.

## MVP Ship Criteria

MVP is ready when:

- Phases 1-5 are complete.
- Hosted browser behavior is unchanged.
- `doc2md.app` can open, edit, save, Save As, reveal in Finder, and handle conflicts.
- Converted document Save As works for supported source formats.
- Asset folder semantics are implemented or explicitly deferred from the shipped converter behavior.
- App can be signed, notarized, packaged as DMG, and updated through Sparkle ZIP updates.
- The release CI workflow builds, signs, notarizes, and publishes without exposing Apple or Sparkle secrets to PRs, forks, or logs.

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
