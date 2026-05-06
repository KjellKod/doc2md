# Mac License Menu And About Licenses Surface

Status: complete
Completed: PR #106

## Problem

Two artifacts in the running Mac app are conflated today, and end users see the wrong one in the wrong slot:

1. **The end-user product license** (the registration token a paying user enters to convert from unlicensed evaluation to a registered copy). Today's entry point is `doc2md → Enter License…` (`apps/macos/doc2md/doc2mdApp.swift:73`, `CommandGroup(after: .appInfo)`). The flow opens `LicenseWindow` (`apps/macos/doc2md/Licensing/LicenseWindow.swift`) which always shows the paste box regardless of whether the user is already licensed. There is no first-class "view my license" surface, and the paste box is visible even after registration.

2. **Bundled third-party notices and source-visible terms** (`apps/macos/THIRD_PARTY_NOTICES.md` and `LICENSES/LicenseRef-doc2md-Desktop.txt`). PR #106 made these discoverable through Help-menu entries and a small standard About-panel credits pointer. That is technically functional, but it is not the target UX. Users should get a polished app-owned About panel, with a simple `Licenses` button that opens an app-owned read-only page headed `Third-Party Licenses`. The Help menu should stay focused on the user's purchased/missing license state.

## Expected Behavior

### A. End-user license menu (under Help, state-driven)

1. Move the existing `Enter License…` item out of the `doc2md` app menu and into the `Help` menu. Use `CommandGroup(after: .help)` (the same additive pattern PR #106 introduced for `Help → Acknowledgments…`).
2. The menu item is state-driven by `LicenseController.state`:
   - `unlicensed` / `invalid` / `licenseCheckFailed` → label **`Enter License…`**, opens existing `LicenseWindow` (which already handles those states correctly).
   - `licensed(VerifiedLicense)` → label **`View License…`**, opens a new `LicenseInfoWindow`.
3. `LicenseInfoWindow` (new SwiftUI view) shows:
   - Tier (`claims.tier`).
   - Issued (`claims.issuedAt`) and Expires (`claims.expiresAt` if non-nil).
   - **Email**: `claims.purchaser`. (Confirm in the issuance code that `purchaser` is the email and not a free-text name; if it's not the email, surface the merchant fields or extend `LicenseClaims` to include an explicit `email` and re-issue. **No clear-text token in this view.**)
   - **Masked token preview**: first 8 + `…` + last 4 of the stored raw token. Helper lives next to `LicenseClaims`.
   - **Remove License…** button → confirm sheet → `LicenseController.clearLicense()`. After removal, the menu label flips back to `Enter License…` automatically because the controller publishes new state.
4. Remove the existing `LicenseWindow` paste box from rendering when state is `licensed` (the registered user reaches `View License…` instead). Keep the paste box for the unlicensed flow.

### B. About panel and third-party licenses

1. Replace the standard About panel with a custom one. Use `CommandGroup(replacing: .appInfo)` in `doc2mdApp.swift` and add `Button("About doc2md") { … }` that presents a small SwiftUI sheet.
2. Use the cmux-style pattern as inspiration. The custom About panel should show:
   - app icon
   - `doc2md`
   - a concise two-line description of what the app does
   - version, build number, and release commit for the artifact
   - buttons for **`Docs`**, **`GitHub`**, and **`Licenses`**
3. Clicking **`Licenses`** opens a separate native read-only window headed **`Third-Party Licenses`**. Plain text is fine; this should not be fancy. It should render the bundled third-party notice inventory from `THIRD_PARTY_NOTICES.md` as the source of truth.
4. The app's own source-visible desktop terms may be linked from the same About panel or included as a separate section/window from that panel, but keep it distinct from the user's purchased-license state.

### C. Cleanup of PR #106's Help menu

1. Remove `Help → License…` (the entry that currently opens `LicenseRef-doc2md-Desktop.txt`). The shareware doc is no longer first-class on the menu bar; its only in-app surface is the About-panel button from §B.
2. Remove or replace `Help → Acknowledgments…` as a primary notices surface. Third-party notices should live behind the About panel's `Licenses` button.
3. The bundled file `LicenseRef-doc2md-Desktop.txt` stays in the `.app` Resources (PR #106's pbxproj patch is unchanged) so Section 9 / SPDX compliance is preserved.

## Implementation Notes

- New SwiftUI files: `LicenseInfoWindow.swift`, `AboutPanel.swift`, `ThirdPartyLicensesWindow.swift` or equivalent. Each begins with `// SPDX-License-Identifier: LicenseRef-doc2md-Desktop`.
- Token-masking helper: a small pure function (e.g. `LicenseToken.maskedPreview(_:prefix:suffix:)`) with a unit test that pins the contract for short and long tokens.
- Menu state binding: `@ObservedObject licenseController: LicenseController` in the `Doc2mdApp` body so `CommandGroup(after: .help)` re-renders on state changes. Verify the SwiftUI command rebuild actually flips the label live (test by entering a license and confirming the menu updates without restart).
- `purchaser` clarification: read `apps/macos/doc2md/Licensing/LicenseClaims.swift` and the issuance/test fixtures to confirm semantic. If `purchaser` is currently a free-text name, decide whether to (i) treat it as the display field anyway, (ii) extend `LicenseClaims` with an explicit `email` and bump `version` to 2, or (iii) extract email from `merchantCustomerID`. Document the decision in the plan.
- Build metadata: read version/build from the bundle. Add release commit metadata during the Mac build so About can display the exact commit for the artifact.
- Build allowlist: any new `NSWorkspace` or other native API usage gets a docs entry in `scripts/build-mac-app.sh` `NATIVE_API_ALLOWLIST`. Same regex `ALLOWED_NATIVE_API_PATTERN` should already cover it; do not modify the regex.
- Confirm the existing `LicenseReminderController` continues to call into the licensing flow correctly when the entry point moves. Reminders surface an `Enter License…` button (`apps/macos/doc2md/Licensing/LicenseReminderController.swift:40`); the in-process callback path should be unchanged.

## Validation

- `npm test -- --run` passes including a new unit test for the masking helper.
- The PR-validation Release build uses the explicit development-key override; plain `npm run build:mac` may fail without production license key material:
  ```bash
  DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer bash scripts/build-mac-app.sh --configuration Release --allow-development-license-key-for-pr
  ```
- Manual macOS smoke opens `.build/mac/Build/Products/Release/doc2md.app` after the PR-validation build:
  - Unlicensed: `Help → Enter License…` opens the paste window. The `doc2md` app menu no longer has `Enter License…`.
  - Enter a valid test license. Without restarting the app, the Help menu item flips to `View License…`. Click it. The new window shows tier, expiry, the registered email, a masked token preview (no clear-text), and a `Remove License…` button.
  - Click `Remove License…`, confirm. Menu item flips back to `Enter License…` and the app returns to unlicensed state.
  - `doc2md → About doc2md` opens the new About panel with icon, two-line description, version, build, release commit, and `Docs` / `GitHub` / `Licenses` buttons.
  - Click `Licenses`. A native read-only window headed `Third-Party Licenses` opens with the bundled notice content. Closing it leaves About intact.
  - `Help → License…` and `Help → Acknowledgments…` are no longer the primary notices/licenses surface.
- Stale-language and forbidden-license-family scans pass.
- `git diff --check main...HEAD` clean.

## Scope

- IN: state-driven `Help → Enter License…` / `View License…` with `LicenseInfoWindow`, masked-token helper + test, custom About panel with `Docs` / `GitHub` / `Licenses` buttons, native third-party licenses window, release commit metadata, cleanup of PR #106's Help-menu notices entries.
- IN: SPDX header on every new Swift file.
- OUT: changes to license issuance, signing, or `LicenseClaims` schema (unless §B `purchaser`-vs-`email` clarification forces a `version` bump — that becomes its own quest if so).
- OUT: changes to `LICENSES/LicenseRef-doc2md-Desktop.txt` content.
- OUT: changes to `.github/workflows/release-mac.yml`.
- OUT: changes to the bundled-resources pbxproj patch from PR #106 (Resources stay bundled exactly as today).

## Priority

Medium. Completed in PR #106. This UX correction makes the menu surface match user expectations: the user license is the user license, third-party notices live behind a polished About-panel `Licenses` button, and Help is reserved for purchased/missing license state.
