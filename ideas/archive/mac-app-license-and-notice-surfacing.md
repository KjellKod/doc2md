# Mac App License And Notice Surfacing

## Problem

The Mac desktop app already bundles `apps/macos/THIRD_PARTY_NOTICES.md` into `doc2md.app/Contents/Resources/`, which satisfies the MIT compliance floor and Section 9 of `LICENSES/LicenseRef-doc2md-Desktop.txt`. The user has the app, not the repository, so pointing at GitHub is not a substitute for in-bundle notices. Bundling alone is the legal floor; the macOS convention is to also surface license/acknowledgments through the menu bar so end-users with a compliance habit can find them.

Two gaps remain:

1. The bundled notices and the desktop license are not discoverable from inside a polished app-owned surface. The current Help-menu/external-open direction is functional, but it is not the target UX: it sends users to whatever app owns `.md` or `.txt` on their Mac, which is often Xcode on development machines.
2. `apps/macos/THIRD_PARTY_NOTICES.md` is hand-maintained. The direct dependency table can drift from `package.json`, `package-lock.json`, and `Package.resolved` between releases without anything failing. The release-notice checkbox in `.github/pull_request_template.md` is the only current safeguard, and a checkbox is a human reminder, not a build gate.

## Expected Behavior

**In-app surfacing**

1. `doc2md → About doc2md` should be a custom app-owned About panel, not only the standard AppKit credits text. Use the cmux pattern as inspiration:
   - app icon
   - `doc2md`
   - a two-line description of what the app does
   - version, build number, and release commit for the build
   - buttons for `Docs`, `GitHub`, and `Licenses`
2. The `Licenses` button in About opens a native, plain text/read-only page headed `Third-Party Licenses`. It can be simple; the important part is that it is app-owned and readable without launching Xcode or another default editor.
3. The `Licenses` page renders the bundled third-party notice inventory and should use the bundled resource as the source of truth.
4. The app's own desktop product license may either be linked from the same About panel or included as a separate section/window from that panel. Keep it distinct from purchase/license-status UX.
5. The Help menu should stay reserved for user license workflows: purchased license, missing license, entering a license key, and related status/reminder actions. Do not use Help as the primary third-party notices surface.

**Programmatic notice generation**

5. A repo script generates the notice inventory from authoritative sources, not by hand.
   - Inputs: `package.json`, `package-lock.json`, `packages/core/package.json`, `apps/macos/doc2md.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved`, and the bundled `dist/` after `npm run build:desktop`.
   - Output: a checked-in `apps/macos/THIRD_PARTY_NOTICES.generated.md` (or refreshed `apps/macos/THIRD_PARTY_NOTICES.md`) with direct dependencies and licenses for the npm and SwiftPM dependency sets actually included in the released artifact.
6. A failing test catches drift: if the generated notice inventory and the committed file disagree, the test fails with a clear instruction to rerun the generator. This converts the human PR-template checkbox into a build-time gate.

## Implementation Notes

**In-app surfacing**

- Add `LICENSES/LicenseRef-doc2md-Desktop.txt` to the `doc2md` target's Copy Bundle Resources phase in `apps/macos/doc2md.xcodeproj/project.pbxproj`. The notices file is already in the phase.
- Replace the current standard About-panel-only surface with a custom SwiftUI/AppKit About window. It should show the app icon, a short description, version/build metadata, release commit, and the three action buttons.
- Add a native read-only licenses window opened by the About panel's `Licenses` button. Plain text is fine; start with the headline `Third-Party Licenses`, then render the bundled notice content.
- Read version/build from the bundle. Add release commit metadata to the bundle during the Mac build so the About panel can display the exact commit for the artifact.
- Keep Help-menu items focused on user licensing status and purchase/license entry. If existing `Help → Acknowledgments…` or `Help → License…` items remain from the first implementation, treat moving/removing them as part of the follow-up so the menu model is not split across two places.
- Add `apps/macos/doc2md/Resources/Credits.rtf` only if still needed for system metadata or accessibility fallback. Do not make it the primary notices surface. Do not put an SPDX comment inside RTF or HTML; the file is desktop-license-covered by location and `apps/macos/LICENSE`. Adding a comment will render as visible text.
- New Swift files start with `// SPDX-License-Identifier: LicenseRef-doc2md-Desktop`.
- Update `apps/macos/README.md` to mention the custom About panel, the `Licenses` button, and the bundled-resource source of truth so docs match the build.

**Programmatic notice generation**

- Script under `scripts/`, e.g., `scripts/generate-notice-inventory.mjs`.
- npm side: walk `package-lock.json` for the production dependency set; resolve each package's `LICENSE` text from `node_modules/<pkg>/LICENSE*` after `npm ci`. Prefer `license-checker-rseidelsohn` or a small custom walker over a heavy plugin.
- SwiftPM side: parse `Package.resolved` for resolved package URLs and revisions. License text for SwiftPM packages can be fetched at build time by reading `apps/macos/.build/checkouts/*/LICENSE*` after `xcodebuild -resolvePackageDependencies` populates them. The script must run after that resolution step or assume the checkout is present.
- Output format: keep the current human-readable Markdown structure of `THIRD_PARTY_NOTICES.md` so the bundled file stays one document. Append a `<!-- generated by scripts/generate-notice-inventory.mjs -->` marker.
- Test under `tests/` (or `apps/macos/doc2mdTests/` if Swift-side, but a Node test is simpler):
  - Run the generator into a temp file.
  - Diff against the committed `apps/macos/THIRD_PARTY_NOTICES.md`.
  - On mismatch, fail with: `Notice inventory drift. Run \`npm run generate:notices\` and commit the result.`
- Wire the generator into `npm run generate:notices` and call it from `npm run build:desktop` (or `npm run build:mac`) so a forgotten run cannot ship.

**Validation for the eventual PR**

- `npm test -- --run` passes including the new drift test.
- The PR-validation Release build uses the explicit development-key override; plain `npm run build:mac` is allowed to fail when production license key material is not embedded:
  ```bash
  DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer bash scripts/build-mac-app.sh --configuration Release --allow-development-license-key-for-pr
  ```
- The resulting `.app` contains:
  - `Contents/Resources/THIRD_PARTY_NOTICES.md`
  - `Contents/Resources/LicenseRef-doc2md-Desktop.txt`
  - any About/licensing resources needed by the native window
- Manual Mac smoke opens `.build/mac/Build/Products/Release/doc2md.app` after the PR-validation build:
  - `doc2md → About doc2md` opens the custom About panel with icon, two-line description, version, build, release commit, and `Docs` / `GitHub` / `Licenses` buttons.
  - `Licenses` opens a native read-only page headed `Third-Party Licenses` and showing the bundled third-party notice content.
  - Help-menu license actions remain about the user's purchased license or missing license state, not third-party notices.
- Stale-language and forbidden-license-family scans (with `.github` in the target list) still pass.
- `git diff --check main...HEAD` clean.

## Scope

- IN: custom About panel, About `Licenses` button, native read-only third-party licenses page, bundle the desktop license file, release commit metadata, `scripts/generate-notice-inventory.mjs`, drift test, package script wiring.
- IN: Update `apps/macos/README.md` to match.
- OUT: using Help as the primary third-party notice/license surface. Help is for the user's purchased license or missing-license state.
- OUT: In-app contribution flow. The `.github/pull_request_template.md` is the contribution surface.
- OUT: Changes to `LICENSES/LicenseRef-doc2md-Desktop.txt` or `apps/macos/THIRD_PARTY_NOTICES.md` content beyond what the generator emits.
- OUT: Changes to the protected release workflow `.github/workflows/release-mac.yml`. Resource-bundling changes are picked up by the existing build path.

## Priority

Medium. The legal floor is met today, so this is not blocking external publication. It is the right friendly-discoverability upgrade and the right time to convert the release-notice human checkbox into a build-time gate before the first signed DMG ships.
