# Mac Desktop App Roadmap

Status: active
Owner: maintainers
Design doc: [Mac Desktop App Design](../docs/implementation/local-editor-install-exploration.md)

## Purpose

Track the Mac-only `doc2md.app` work across multiple quests and PRs. The design doc defines the product and technical contract; this roadmap defines sequencing, PR boundaries, dependencies, and completion criteria.

The work should not ship as one PR. It crosses repo structure, Xcode project setup, React desktop-mode integration, native Swift filesystem behavior, asset persistence, and release infrastructure. Each phase should be independently reviewable and should leave the repo in a working state.

## Product Target

Build a Mac-native DMG app using Swift + `WKWebView` + Sparkle. The existing hosted browser app remains unchanged for cross-platform use. The Mac shell owns native filesystem, dialogs, menus, signing, notarization, and update checks. The React app and existing converters continue to own conversion, editing, preview, and Markdown state.

Commercial boundary:

- Keep the hosted web app at `https://kjellkod.github.io/doc2md/`, npm packages, and shared conversion logic free.
- Do not promote, price, or download-link the Mac app from the hosted web app's main page until the commercial distribution plan is intentionally chosen.
- Treat the Mac app as its own distribution surface: usable without payment, but eligible for a simple paid license with occasional reminders in the spirit of Sublime Text.
- Prefer a sales/distribution channel that acts as the merchant of record or otherwise handles tax collection/remittance for the maintainer.

## Phase Overview

| Phase | Status | Quest / PR | Goal | Blocks |
|---|---|---|---|---|
| 0. Design and Roadmap | active | Current docs | Freeze product direction and PR sequence. | Phase 1 |
| 1. Mac Shell Scaffold | done | PR #77 | Add `apps/macos/`, Xcode shell, desktop web bundle path, Debug/Release loading. | Phase 2 |
| 2. Bridge and React Desktop Mode | done | PR #78 (`mac-phase2-bridge_2026-04-21__0712`) | Add bridge types, mock shell, native menu events, desktop save-state plumbing. | Phase 3 |
| 2.5. Developer Mac Build Helper | done | PR #79 (`mac-build-smoke_2026-04-21__2246`) | One-command local `.app` build with a fixed output path and a README pointer so manual testing is predictable. | Smooths Phase 3+ manual smoke |
| 3. Markdown File Persistence | done | PR #80 (`mac-file-persistence_2026-04-22__2017`) | Implement open/save/save-as for Markdown with atomic replace, mtime conflicts, line endings, Finder reveal, and rendered-UI launch smoke. | Phase 4 |
| 4. Converted Document Import and Markdown Persistence | done | PR #81 (`phase-4-converted-docs-persistent-assets_2026-04-23__2328`) | Import any supported non-`.md` source document through the existing converters, first-save to `.md`, keep later saves anchored to the chosen Markdown file, and handle large native-open payloads robustly. | Phase 5 |
| 5a. Mac PR CI Check | done | PR #83 | Add a no-secrets GitHub Actions workflow that runs `npm run build:desktop` + unsigned `xcodebuild build` + `swiftc -parse` + forbidden-API grep on every PR so Mac-only regressions cannot land silently. | Phase 5b |
| 5b. Sparkle Plumbing | done | PR #84 | Add Sparkle 2 to the Xcode project, wire `SUFeedURL` / `SUPublicEDKey` in Info.plist, define the appcast XML schema, and verify offline + test-appcast update detection. No signing, no release automation. | Phase 5c |
| 5c. Release CI, Signing, Notarization, DMG, Appcast Publish | done | PR #85 (`mac-release-ci_2026-04-25__0010`) | Tag-triggered macOS release workflow with a protected `mac-release` Environment: Developer ID signing, notarization, stapling, DMG, Sparkle ZIP + `sign_update`, appcast publish. The only phase that touches Apple or Sparkle secrets. | MVP ship |
| 6. Editor and UI Refresh (cross-surface) | active | Phase 6a PR #86; Phase 6b PR #88 (`persistent-mode-switcher_2026-04-27__2355`); Phase 6c PR #87 (`save-control-ui_2026-04-27__1212`) | Hosted-web + Mac editor polish: app icon, persistent mode switcher, explicit save control, find/replace, accessibility audit, keyboard-shortcut help. Runs in parallel with Phase 5b+ because it does not touch the Mac shell contract. | MVP polish |
| 7. Mac Commercial Distribution and Licensing | planned | TBD | Decide whether the Mac app ships through the Mac App Store, direct DMG sales, or both; add a simple nag-based license model without changing the free hosted web/npm surfaces. | Paid app launch |

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

Status note:

- Completed in PR #80.
- Phase 3 intentionally stopped at Markdown/text persistence. Recent files, persisted security-scoped bookmarks, autosave, converted-document asset persistence, and release/distribution work remain outside this phase.
- Phase 4 reclassifies all supported non-`.md` formats, including `.txt`, as import-only source documents for a consistent user model.

Expected changes:

- Implement `openFile()` for `.md`, `.markdown`, and `.txt` files.
- Implement `saveFile()` and `saveFileAs()` for Markdown.
- Use `FileManager.replaceItem(at:withItemAt:backupItemName:options:resultingItemURL:)` for final replacement.
- Track `mtimeMs` and reject saves on conflict.
- Preserve line endings by sampling the first 4 KB.
- Implement `revealInFinder()`.
- Rendered-UI launch signal (tracks PR #79 review feedback): replace the Phase 2.5 smoke's reliance on `load succeeded` (fired from `WKWebView.didFinish`) with a stronger `app ready` signal. Add a `data-app-ready` marker on the React toolbar root after mount; after `didFinish`, the Swift side runs a bounded `evaluateJavaScript` probe and emits `logger.notice("app ready: true")` on success or `logger.error("app ready: false: <reason>")` on timeout. Update `scripts/verify-mac-release-launch.sh` to require `app ready: true`, downgrading `load succeeded` to a weaker precondition. No AppleScript / System Events, no new permissions. Closes the "React crashes after navigation finished" gap raised in the PR #79 top-level comment.

Acceptance criteria:

- User opens an existing `.md`, edits, and saves with Cmd+S.
- User creates a new draft and saves with Cmd+Shift+S.
- Save rejects when the file changed externally since open or last save.
- Save is atomic and does not leave partial files.
- Finder reveal works for saved files.

Validation:

- Swift unit tests for `FileStore`: atomic replace, mtime conflict, CRLF/LF detection, and cancel/error/permission mapping.
- React tests for save-state transitions.
- Manual open/edit/save, Save As, external conflict, and Finder reveal checks.

## Phase 4: Converted Document Import And Markdown Persistence

Goal:

Persist converted document output as Markdown while treating every supported non-`.md` format as an import-only source document.

Status note:

- Completed in this quest.
- Phase 4 ships robust native-open transport for non-`.md` files, first-save-to-Markdown behavior for every supported import format including `.txt`, and the same embedded-asset dropping behavior as the hosted web app.

Expected changes:

- Route every supported non-`.md` source document through the existing webview converters after native open.
- Treat `.txt`, `.csv`, `.json`, `.tsv`, `.html`, `.docx`, `.xlsx`, `.pdf`, and `.pptx` the same from the user's perspective: they import into editable Markdown, but they are not saved back to their original source path.
- Save converted output only via explicit Save As on first save, always targeting `.md`.
- Limit direct in-place Save to existing `.md` files.
- Use a robust native-to-web payload handoff for non-`.md` opens so large files do not rely on oversized bridge JSON payloads.
- Keep embedded images and other assets consistent with the hosted web product: drop them rather than writing `name.assets/` folders.

Acceptance criteria:

- User opens any supported non-`.md` source document, reviews/edits the resulting Markdown, and saves via Save As to a `.md` target.
- After that first Save As, further saves update the chosen `.md` file with the existing conflict detection behavior.
- No supported non-`.md` source document is overwritten in place.
- Large native-open source files do not fail because of bridge-payload size limits.
- Embedded images and other source-document assets are dropped consistently with the hosted web behavior.

Validation:

- Unit tests for native-open import results, direct-save-vs-import-save-as behavior, and large-payload transport.
- Manual conversion/save for at least one text-like source (`.txt`, `.csv`, or `.html`) and one binary source (`.docx`, `.pdf`, `.xlsx`, or `.pptx`).
- Regression check that hosted browser download flow still works.

## Phase 5: Distribution And Updates (Split)

Phase 5 as originally written bundled CI, Sparkle, and signing/notarization into one unit. Splitting into 5a/5b/5c so each quest is independently reviewable, lands in working state, and sequences risk from low (5a, no secrets) to high (5c, Apple + Sparkle keys).

### Phase 5a: Mac PR CI Check

Goal:

Close the "Mac-only code has zero CI" gap before we introduce release automation. Every PR should get an unsigned Mac build + Swift parse + forbidden-API grep on `macos-latest`, with no secrets scope.

Expected changes:

- Add a new GitHub Actions workflow (for example `.github/workflows/mac-pr-check.yml`):
  - Triggers: `pull_request` (never `pull_request_target`).
  - Runner: `macos-latest`.
  - Permissions: `contents: read` only. No secrets scope.
  - Steps: checkout, Node setup, `npm ci`, `npm run build:desktop`, `bash scripts/build-mac-app.sh --configuration Release` (the helper already runs `swiftc`-equivalent checks and the forbidden-API grep via `xcodebuild` + the allowlist scan).
  - Optional: upload the unsigned `.app` as a workflow artifact for reviewer smoke on macOS hosts.
- Pin third-party actions by full SHA (repo CI-trustworthiness convention).

Acceptance criteria:

- PRs that break the desktop web bundle, the Xcode build, or the forbidden-API allowlist fail the new check.
- The check runs on fork PRs because it needs no secrets.
- No secrets are introduced in this phase.

Out of scope (deferred to 5b/5c):

- Sparkle, appcast, DMG, signing, notarization, release tagging.

Validation:

- Push a branch that intentionally breaks the Xcode build. Confirm the new check fails.
- Push a branch that intentionally adds a forbidden native API. Confirm the allowlist scan fails.
- Push a clean branch. Confirm the check passes.

### Phase 5b: Sparkle Plumbing

Goal:

Add the Sparkle 2 update framework to the Mac app, wire the appcast contract, and verify update detection locally against a test appcast. No release automation and no signing yet.

Status note:

- Completed in PR #84.
- Phase 5b intentionally stopped at local/test Sparkle plumbing. Production signing, notarization, DMG packaging, EdDSA update signing, and release appcast publishing are handled by Phase 5c.

Expected changes:

- Add Sparkle 2 as a Swift Package dependency in `apps/macos/doc2md.xcodeproj`.
- Add `SUFeedURL` and `SUPublicEDKey` to `Info.plist`.
- Generate a throwaway EdDSA key locally and commit only the public key.
- Define the production and beta appcast XML schema, with at least one fixture appcast checked into `apps/macos/doc2md/test-fixtures/`.
- Wire Sparkle's standard updater controller into the AppKit scene and expose a "Check for updates..." menu item.
- Handle offline launch: update checks must not block the main window or fail the launch smoke.
- Keep update checks behind a build-time flag in Debug so local development does not ping appcasts.

Acceptance criteria:

- The app launches with Sparkle initialised and the "Check for updates..." menu item visible.
- Pointed at the fixture appcast, Sparkle correctly detects a newer version and shows the standard update sheet.
- Offline launch succeeds without a Sparkle-related stall or error.
- The release-launch smoke still passes.

Out of scope (deferred to 5c):

- Signing, notarization, DMG build, real `sign_update` signing, production appcast publish, release tagging.

Validation:

- Serve the fixture appcast locally (`python3 -m http.server`) with a bumped version and confirm Sparkle prompts.
- Disconnect from the network, relaunch the app, confirm no blocking.
- Re-run `scripts/verify-mac-release-launch.sh` to confirm the smoke path still succeeds.

### Phase 5c: Release CI, Signing, Notarization, DMG, Appcast Publish

Goal:

Ship the Mac app signed, notarized, DMG-installable, and Sparkle-updateable through a tag-triggered CI workflow that isolates Apple and Sparkle secrets behind a protected Environment.

Expected changes:

- Document and script release steps for Developer ID signing, hardened runtime, notarization (`xcrun notarytool`), stapling, Sparkle `sign_update`, and appcast generation.
- Use DMG for first install.
- Use ZIP of the `.app` bundle for Sparkle updates.
- Keep Apple notarization credentials separate from Sparkle EdDSA keys.

### CI Release Workflow (macos-latest)

Add a new workflow (for example `.github/workflows/release-mac.yml`) that builds, signs, notarizes, and packages the Mac app. It does NOT run on every PR and does NOT run on forks.

- Triggers: `push` on a semver release tag (for example `v*`) plus `workflow_dispatch` with required reviewers. Never trigger signing from `pull_request` or `pull_request_target`. Forked-PR events do not receive secrets; CI still runs the no-secrets build checks on PRs (see below).
- Jobs, each minimal and isolated:
  1. `build`: `macos-latest`, no secrets, runs `npm run build:desktop` + `xcodebuild -configuration Release` + `swiftc -parse` + the forbidden-API grep. Uploads the unsigned `.app` as a job artifact.
  2. `sign-and-notarize`: `macos-latest`, consumes the `build` artifact, targets a protected GitHub Environment (for example `mac-release`) with required reviewers. This is the only job that touches secrets.
  3. `package`: builds the DMG and the Sparkle update ZIP from the signed artifact, signs the ZIP with the EdDSA key in a separate step, and updates the appcast.
  4. `publish`: publishes the DMG and appcast to the release target (GitHub Release assets or the appcast host). Read-only `GITHUB_TOKEN` permissions by default; widen only for the specific publish step.
- The no-secrets PR check workflow is covered by Phase 5a and must already be in place before this workflow is introduced.

### Secrets Handling Rules (binding)

- All Apple and Sparkle secrets live only in GitHub Encrypted Secrets scoped to the `mac-release` protected Environment. Never in the repo, never in Actions variables, never in logs.
- Minimum secret set and intended use:
  - `APPLE_DEVELOPER_ID_CERT_P12` (Base64 of the `.p12` Developer ID Application cert). `APPLE_DEVELOPER_ID_CERT_PASSWORD` (password for the `.p12`).
  - `APPLE_NOTARY_API_KEY_ID`, `APPLE_NOTARY_API_ISSUER_ID`, `APPLE_NOTARY_API_KEY_P8` (Base64 of the App Store Connect API key) — used by `xcrun notarytool`.
  - `SPARKLE_EDDSA_PRIVATE_KEY` (raw Sparkle EdDSA private key text matching the committed `SUPublicEDKey`) — used only by `sign_update`.
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

## Phase 6: Editor And UI Refresh (Cross-Surface)

Goal:

Clean up the editor/viewer UX across the hosted browser app and the Mac shell. These items are surface-level and do not touch the shell contract, so they can run in parallel with Phase 5b/5c without blocking release work. Each item should be its own quest or a tightly-scoped quest group — not one giant PR.

### 6a. Mac App Icon

- Status: done in PR #86.
- Design or commission an `.icns` icon set (multiple sizes: 16, 32, 64, 128, 256, 512, 1024, plus @2x variants).
- Add as an Xcode asset catalog (`Assets.xcassets/AppIcon.appiconset`).
- Update `apps/macos/README.md` to describe how to update the icon.
- Acceptance: the built `.app` shows the new icon in Finder, Dock, and the "About" dialog.

### 6b. Persistent Mode Switcher (Edit / Preview / LinkedIn)

- Status: done in PR #88 (`persistent-mode-switcher_2026-04-27__2355`).
- Today the Edit / Preview / LinkedIn mode buttons live in a toolbar that scrolls away with the content. Users have to scroll up to switch modes.
- Make the mode switcher stick to the top of the viewport (or dock into a compact floating control) so it is always reachable.
- Handle edge cases carefully: mobile viewport, preview-pane collapse state, split-pane resizer, keyboard focus ring, scroll position after mode switch.
- This is a UX-sensitive change and can regress familiar behavior — budget time for manual testing on desktop + mobile across all three modes.
- Acceptance: user can switch modes at any scroll position without scrolling back to the top. No regression in preview pane collapse behavior or split-pane resizing.

### 6c. Explicit Save Control (Mobile-Safe)

- Status: done in PR #87 (`save-control-ui_2026-04-27__1212`).
- Add a visible Save button next to the mode switcher (or in a save-state pill) so mobile users without a physical Cmd+S have an explicit path.
- Decide per-surface behavior: on the Mac app, the button triggers the native save path (same as Cmd+S); on the hosted browser, it triggers the existing download-based save flow.
- Confirm existing keyboard shortcut (Cmd+S / Ctrl+S) still works; the button is additive, not a replacement.
- Acceptance: user can save from mobile. Save state (`Saved`, `Edited`, `Saving`, `Conflict`, `Error`) is visible next to the button.

### 6d. Find / Replace In Editor

- Add keyboard shortcut (Cmd+F / Cmd+Option+F) and a visible entry point.
- Case sensitivity and regex options. Highlight all matches; step through with Enter / Shift+Enter.
- Acceptance: round-trip search-and-replace on a 100 KB document is responsive (no janky UI freeze).

### 6e. Keyboard Shortcut Cheatsheet

- Status: deferred until after the signed/notarized DMG installer is working and the Mac app licensing/payment structure is decided.
- YAGNI-reduced scope: add only a compact shortcut reference if the app has enough real shortcuts to justify discoverability work after 6d.
- If implemented, prefer a small `?` / Help entry that lists only shortcuts the app actually supports.
- Keep it cross-surface only if the same shortcuts exist in both hosted web and Mac. Desktop-only menu wiring can wait.
- Do not build a command palette, onboarding tutorial, configurable shortcut system, searchable help center, or shortcut-remapping UI in this phase.
- Acceptance if revived: users can discover the real supported shortcuts without visual clutter, and no entry claims a shortcut that does not exist.

### 6f. Accessibility Audit

- Status: deferred until after the signed/notarized DMG installer is working and the Mac app licensing/payment structure is decided.
- YAGNI-reduced scope: do a lightweight accessibility pass only, focused on obvious usability bugs and invisible screen-reader affordances.
- Preserve the current visual design where possible. Prefer invisible-but-helpful improvements such as `aria-label`, `aria-labelledby`, `aria-live`, accurate roles, and visible focus behavior.
- Check keyboard-only reachability for primary controls that already exist: upload/open, edit, mode switcher, save, find/replace, copy, and close/dismiss controls.
- Check that icon-only buttons have meaningful accessible names without adding visible labels unless the UI is also unclear to sighted users.
- Check status/error announcements for save state, find/replace errors, and conversion errors where those states already exist.
- Do not pursue formal WCAG certification, exhaustive assistive-technology matrix testing, a custom accessibility test harness, or a broad visual redesign in this phase.
- Acceptance if revived: obvious keyboard/screen-reader dead ends are fixed, primary controls have accessible names, status changes are understandable, and the hosted app does not regress materially in Lighthouse accessibility checks.

### 6g. Open Slot: "??? — User Backlog"

Reserved for items the maintainer adds on the fly. Candidates surfaced during scoping of this phase:

- Optional: dark-mode / system-theme follow.
- Optional: "Copy rendered Markdown" and "Copy LinkedIn text" buttons next to the mode switcher.
- Optional: session-local scratch buffer so refresh / accidental navigation does not erase unsaved work in the hosted browser.
- Optional: PWA install hint for mobile users of the hosted app.

## Phase 7: Mac Commercial Distribution And Licensing

Goal:

Keep the hosted web app and npm ecosystem free while making the Mac app a simple paid product. The Mac app should remain usable without payment, but unpaid users may see occasional license reminders. The tone should be practical and respectful: no document lock-in, no data hostage behavior, no artificial conversion limits.

Distribution assumptions:

- Do not put a Mac app upsell, pricing page, or download CTA on the hosted web app's main page until this phase explicitly chooses a distribution model.
- Evaluate Mac App Store distribution, direct signed DMG sales, or both. The release pipeline already supports direct signed/notarized DMG + Sparkle updates; App Store distribution would need a separate packaging/review path.
- Prefer a merchant-of-record style sales platform or store channel that handles tax collection/remittance, VAT/GST/sales-tax paperwork, invoices/receipts, and customer purchase records.
- Keep pricing easy to understand. Working hypothesis, not a commitment: a low annual price around `$20/year`, plus an optional perpetual license that lasts until the next major paid upgrade.
- Keep license enforcement offline-friendly. The app should not require network access to open, edit, convert, save, or export documents.

Expected changes:

- Add a lightweight licensing model for the Mac app only:
  - `Licensed`, `Unlicensed`, `Trial/Grace`, and `License Check Failed` states.
  - A local license file or activation token stored in the user's Application Support directory or Keychain.
  - Occasional nag reminder for unlicensed users after a simple trigger, such as every N launches or every N exports/saves.
  - A license entry window reachable from the app menu.
- Add release-channel wording:
  - Hosted web and npm remain free.
  - Mac app license supports native packaging, signing, notarization, Sparkle updates, and ongoing maintenance.
  - Unlicensed users may continue using the app if they accept reminders.
- Add privacy and trust guardrails:
  - No document contents are sent to a licensing provider.
  - License checks must not block local document access.
  - Failed network checks degrade to a reminder, not data loss.
  - No license secrets, signing keys, or vendor API keys are committed.
- Add a distribution decision record comparing:
  - Mac App Store only.
  - Direct DMG only.
  - Hybrid: direct DMG first, App Store later if it is worth the operational cost.

Acceptance criteria:

- The hosted web app does not advertise or depend on the paid Mac app.
- The Mac app can run unlicensed with occasional reminders.
- A licensed user can enter/restore a license without editing config files.
- License state survives relaunch.
- Offline launch and document editing still work.
- Pricing copy is simple and non-deceptive.
- Tax/sales operational ownership is documented before taking money.

Out of scope until the distribution decision is made:

- Final price.
- Final license provider.
- App Store receipt validation.
- Server-side license API.
- Anti-tamper work beyond honest-user license checks.

## MVP Ship Criteria

MVP is ready when:

- Phases 1, 2, 2.5, 3, 4, 5a, 5b, and 5c are complete.
- Phase 6 items are tracked but NOT gating for MVP ship; they land opportunistically.
- Phase 7 is tracked but NOT gating for the free/open MVP. It gates paid Mac app launch only.
- Hosted browser behavior is unchanged.
- `doc2md.app` can open, edit, save, Save As, reveal in Finder, and handle conflicts.
- Converted document Save As works for supported source formats.
- Non-`.md` source formats import into Markdown, first-save to `.md`, and are never overwritten in place.
- Desktop conversion output matches hosted web behavior for embedded assets: they are dropped unless the shared converter behavior changes in a later phase.
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
