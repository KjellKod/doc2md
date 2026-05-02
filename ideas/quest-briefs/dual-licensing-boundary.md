# Quest Brief: Dual Licensing Boundary

Copy the block below into `/quest` to start the run. The brief is written to be pasted verbatim; edit only if the licensing decision changes.

```
Quest brief: Dual Licensing Boundary

Context

- The repo currently presents itself as repo-wide MIT in root `LICENSE`, root `package.json`, and `README.md`.
- `@doc2md/core` should remain MIT. It is the reusable conversion engine, Node API, and CLI package.
- The hosted web app should remain open and trust-first.
- The Mac desktop app now has shareware/commercial licensing behavior, Sparkle update plumbing, signed release machinery, app-specific assets, app branding, and license-reminder logic.
- Repo-local proposal: `ideas/archive/doc2md-dual-licensing.md`.
- External source notes were distilled from:
  - `/Users/kjell/Documents/Evaluations/doc2md_license_draft.md`
  - `/Users/kjell/Documents/Evaluations/doc2md_license_research_prompt.md`

Goal

Land a clear mixed-license structure for doc2md:

1. Preserve MIT for the conversion core, package/CLI, and hosted web trust surface.
2. Make the Mac desktop app source-visible shareware/commercial code instead of accidentally repo-wide MIT.
3. Use actual repo paths and avoid ambiguous boundaries.
4. Validate whether an existing source-available license can satisfy the Mac app's needs before relying on custom license text.

Required planning/research scope

1. Review `ideas/archive/doc2md-dual-licensing.md` and the current repo layout.
2. Validate license options for the Mac desktop app:
   - Custom doc2md Desktop Shareware License / Mac app EULA plus source-available notice.
   - Business Source License 1.1.
   - Functional Source License / Fair Source style licenses.
   - Elastic License 2.0.
   - PolyForm variants.
   - GPL/AGPL plus commercial exception.
   - SSPL/commercial dual licensing.
   - Private Mac app repo.
3. For each option, document:
   - OSI open-source status.
   - Whether it permits free use of the official app.
   - Whether it permits or blocks redistribution of modified desktop apps.
   - Whether it blocks resale/repackaging/marketplace cloning.
   - Whether it permits internal commercial use of the official app without requiring a commercial agreement.
   - Fit for a source-visible shareware Mac app with no feature gating.
   - User trust impact.
   - Tooling/GitHub/npm metadata implications.
4. Make a clear recommendation. If custom license text remains the recommendation, make the maintainer-owned release boundary explicit.
5. Audit contribution/provenance risk before relicensing existing desktop files:
   - visible non-owner commits
   - co-authors
   - copied snippets
   - generated files
   - vendored assets
   - app icon/source assets
   - third-party notices
6. Resolve the actual path boundary:
   - `packages/core/` must remain MIT.
   - `apps/macos/` should be desktop shareware/source-available.
   - root `src/` hosted web code should remain MIT unless there is a stronger reason.
   - `src/desktop/` and desktop-only code currently embedded in `src/App.tsx` must be handled deliberately. Prefer keeping `src/` MIT for this quest unless the plan moves desktop-only React code into a clear path boundary first.
7. Decide how app icons, screenshots, branding, release signing/update machinery, generated files, test fixtures, and docs are licensed.
8. Decide whether to document or create a last repo-wide MIT tag/release boundary, such as `vX.Y.Z-last-mit`.
9. Decide future contribution policy:
   - MIT areas may use inbound=outbound or DCO.
   - non-MIT desktop areas should require a CLA or explicit contributor agreement, or the project should not accept outside contributions there.

Required implementation scope

1. Replace the root `LICENSE` with a license map that explains the mixed-license model. Do not leave the root `LICENSE` as plain MIT.
2. Move or copy the current MIT text into `LICENSES/MIT.txt`.
3. Add `LICENSES/LicenseRef-doc2md-Desktop.txt` or a selected existing source-available license file.
4. Add `apps/macos/LICENSE` pointing to the desktop license and stating that `apps/macos/` is not MIT.
5. Add `packages/core/LICENSE` pointing to `../../LICENSES/MIT.txt`.
6. If `src/desktop/` is non-MIT, add `src/desktop/LICENSE`. If it remains MIT for this quest, state that clearly in `docs/licensing.md` and leave code movement as a follow-up.
7. Add `docs/licensing.md` with a plain-English guide:
   - what is MIT
   - what is desktop/shareware/source-visible
   - what users may do for free
   - what requires written permission
   - branding/trademark boundary
   - third-party dependency note
   - prior MIT release note
   - lawyer-review disclaimer for the custom license if applicable
8. Update `README.md` license section so it no longer says the whole project is MIT.
9. Update root `package.json` from `"license": "MIT"` to `"license": "SEE LICENSE IN LICENSE"` because the root workspace is private and mixed-license.
10. Keep `packages/core/package.json` as `"license": "MIT"`.
11. Add SPDX guidance to `docs/licensing.md`:
    - `SPDX-License-Identifier: MIT`
    - `SPDX-License-Identifier: LicenseRef-doc2md-Desktop`
12. Do not add broad file headers across the repo unless the plan explicitly scopes them. Add headers only where needed to remove ambiguity.
13. Add or update Mac-app third-party/internal notice guidance, including required MIT notices for bundled internal MIT code and third-party dependencies.

Acceptance criteria

- `README.md` clearly states doc2md uses a mixed-license model.
- No root-level metadata implies the entire repository is MIT.
- `packages/core/package.json` remains MIT.
- `packages/core/LICENSE` points to the MIT license.
- `apps/macos/LICENSE` states the Mac desktop app is not MIT and points to the desktop license.
- `docs/licensing.md` uses actual repo paths: `apps/macos`, `packages/core`, and `src`.
- The desktop license text does not accidentally restrict independent use of MIT-licensed `@doc2md/core`.
- The desktop license text distinguishes internal use of the official app from redistribution/resale/repackaging.
- The docs call the Mac app "source-visible shareware" or equivalent, not "open source", unless an OSI license is actually selected.
- The plan explicitly documents how `src/desktop/` and desktop-only code in `src/App.tsx` are treated for this quest.
- The final PR includes a lawyer-review checklist or warning for custom legal text.
- The final plan/doc includes a contribution/provenance audit result or a clearly documented blocker.
- The docs state that prior MIT releases remain MIT and cannot be clawed back.
- The Mac-app notice strategy preserves MIT notices for MIT code bundled into the app.

Validation

- Run `npm run typecheck`.
- Run `npm run lint`.
- Run `npm test`.
- Run `npm run test:core`.
- Run `npm run build`.
- If implementation changes any Mac-app code or Xcode project metadata, also run `npm run build:mac`; otherwise explain why doc-only/package-metadata changes do not require it.
- Run text checks:
  - `rg -n "licensed under the \\[MIT License\\]|This project is licensed under the MIT License|\\\"license\\\": \\\"MIT\\\"" README.md package.json LICENSE docs packages apps`
  - Confirm matches are expected only for MIT-scoped areas, not repo-wide claims.
  - `rg -n "apps/mac|packages/cli|apps/web" LICENSE README.md docs/licensing.md packages apps`
  - Confirm no stale placeholder paths remain in landed license docs.

Constraints

- Do not relicense `@doc2md/core` away from MIT.
- Do not claim the custom desktop license is legally final.
- Do not call the desktop license "open source" if it restricts redistribution or commercial use.
- Do not add feature gating or change license reminder behavior in this quest.
- Do not move large code paths just to make license boundaries prettier unless the plan shows that the move is necessary and low risk.
- Do not use `apps/mac`; this repo uses `apps/macos`.
- Do not use vague restrictions like "substantially similar apps". Prefer restrictions tied to covered files, derivative works, redistribution, resale, sublicensing, and branding confusion.
```

## Recommended Quest Mode

Run as a full quest if license text and boundary decisions are part of the implementation. A solo quest is acceptable only if the implementation is limited to documentation, package metadata, and license-map files, with custom text kept narrow and release-ready.
