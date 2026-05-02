# doc2md Dual Licensing Boundary

## Status

Active proposal for a licensing cleanup quest. This is an engineering and business brief for final maintainer approval before release.

## Problem

`doc2md` currently presents the whole repository as MIT:

- root `LICENSE` is MIT
- root `package.json` says `"license": "MIT"`
- `README.md` says the project is licensed under MIT
- `packages/core/package.json` correctly says `"license": "MIT"`

That was clean when the product was a hosted client-side converter and package/CLI. It is now too broad because the repo also contains a Mac desktop app with commercial/shareware licensing behavior, Sparkle update plumbing, signed release machinery, app branding, and app-specific assets.

The goal is not to hide the source. The goal is to preserve trust in the open conversion engine while making the Mac desktop app's commercial boundary explicit.

## Recommendation

Use a mixed-license public repository:

| Area | Recommended treatment |
| --- | --- |
| `packages/core/` | MIT. This is the reusable converter, Node API, and CLI package surface. |
| Hosted web app | MIT unless a later decision says otherwise. This keeps the browser-first trust story simple. |
| Shared conversion logic under `src/converters/`, `src/shared/`, and related hosted-web code | MIT. |
| `apps/macos/` | Covered by a separate doc2md Desktop Shareware / source-available commercial license. |
| Mac app assets, icons, screenshots, app name, trade dress, release signing/update machinery | Not MIT; mark as desktop/shareware license or all rights reserved where appropriate. |
| `src/desktop/` and desktop-only React behavior inside `src/App.tsx` | Resolve deliberately during planning. Prefer moving desktop-only web code behind a clear path boundary before assigning a non-MIT license. |
| Documentation | Prefer MIT for simplicity unless docs contain product branding/assets that should be reserved. |

Keep `@doc2md/core` MIT. Do not move the open core to Apache-2.0 unless patent language becomes an explicit business requirement; a relicensing campaign would add friction without addressing the main risk.

## Existing Repo Boundary

The draft external notes used placeholder paths such as `apps/mac/`, `apps/web/`, and `packages/cli/`. The actual repo is different:

- Mac native app: `apps/macos/`
- Converter package and CLI: `packages/core/`
- Hosted web app: root Vite/React app under `src/`
- Desktop bridge React code: `src/desktop/`
- Desktop-only UI and behavior also appears inside `src/App.tsx`

This means a simple rule of "`apps/macos/` proprietary, everything else MIT" protects the native shell and distribution path, but it does not fully cover the desktop web experience bundled into the Mac app. A quest should either:

1. keep `src/` MIT and accept that the commercial protection is the native shell, app distribution, updates, licensing, and branding; or
2. move desktop-only React code into a clear desktop-owned path before marking it non-MIT.

Avoid trying to make small blocks inside `src/App.tsx` proprietary with comments. That is confusing and brittle.

## Candidate License Options To Validate

The default assumption is a custom doc2md Desktop Shareware License or Mac app EULA plus source-available repository notice because the desired behavior is close to a traditional app EULA:

- source visible
- official app free to use, including internal commercial use
- no feature gating
- reminders until paid
- no redistribution, resale, sublicensing, commercial repackaging, renamed/forked public builds, derivative desktop app publication, bundled distribution, or branding reuse without written permission

Before committing to custom text, validate existing source-available licenses:

| Option | Fit | Concern |
| --- | --- | --- |
| Custom doc2md Desktop Shareware License / EULA | Best fit for the exact shareware app model. Can allow free use while blocking redistribution, sublicensing, resale, commercial repackaging, renamed builds, bundled distribution, and branding confusion. | Custom text is harder for users/tools to classify. Not OSI open source. |
| Business Source License 1.1 | Existing source-available template with delayed open-source conversion. | Poor desktop fit. Grants copying/modification/redistribution and non-production use by default; "production use" is awkward for a desktop app; requires eventual open-source conversion no later than the license limit. |
| Functional Source License / Fair Source | Existing fair-source style with delayed conversion to MIT/Apache. | Designed around non-compete production restrictions, often service-oriented; permits broad use/modification/distribution and forces eventual permissive conversion. |
| Elastic License 2.0 | Short existing source-available license with limited restrictions. | Too permissive. Allows use, modification, derivative works, and redistribution; restrictions focus on managed services, license-key circumvention, and notices. |
| PolyForm Perimeter / Shield | Closer if the main concern is competitors. | Still not a simple no-redistribution/no-repackaging desktop EULA; "competes" can be fuzzy. |
| PolyForm Noncommercial / Strict / Small Business variants | Existing non-OSI licenses with business-use limits. | May block internal commercial use of the official app, which conflicts with the honest-user-friendly shareware goal. |
| GPL/AGPL plus commercial exceptions | Standard open-source path with commercial dual licensing. | Cannot prohibit commercial use or redistribution. AGPL's network obligations are not a good fit for a local Mac app. |
| SSPL/commercial dual licensing | Anti-hosting pattern for server software. | Not relevant to a local Mac desktop app. Heavy and controversial for this use case. |
| Private Mac app repo | Strongest business boundary. | Loses public-source trust and complicates monorepo workflows. |

## License Structure To Land

Suggested target shape:

```text
doc2md/
  LICENSE
  LICENSES/
    MIT.txt
    LicenseRef-doc2md-Desktop.txt
    THIRD-PARTY-NOTICES.md
  packages/
    core/
      LICENSE
  src/
    desktop/
      LICENSE
  apps/
    macos/
      LICENSE
      THIRD_PARTY_NOTICES.md
  docs/
    licensing.md
```

Root `LICENSE` should become a license map, not the full MIT license by itself. Keep the MIT text in `LICENSES/MIT.txt`. Leaving root `LICENSE` as plain MIT would continue to imply repo-wide MIT.

`packages/core/LICENSE` should point to `../../LICENSES/MIT.txt`.

`apps/macos/LICENSE` should say the Mac desktop app is not MIT and points to the desktop shareware/source-available license.

If `src/desktop/` is non-MIT, add `src/desktop/LICENSE` too. If `src/desktop/` stays MIT for the first landing, document that explicitly and defer any code movement.

Root `package.json` is private and mixed-license, so use:

```json
{
  "license": "SEE LICENSE IN LICENSE"
}
```

Keep `packages/core/package.json` as:

```json
{
  "license": "MIT"
}
```

## README Language

Replace the current repo-wide MIT sentence with a short map:

```markdown
## License

doc2md uses a mixed-license model.

The conversion engine, `@doc2md/core` package, CLI, and hosted web app are licensed under the MIT License.

The Mac desktop app in `apps/macos/` is source-visible shareware and is covered by a separate desktop license. You may inspect the source and use the official app, but you may not redistribute, sell, sublicense, commercially repackage, publish derivative desktop apps, or reuse doc2md branding without written permission.

See [LICENSE](LICENSE) and [docs/licensing.md](docs/licensing.md).
```

## Draft Desktop License Shape

The desktop license should cover:

- scope: `apps/macos/`, Mac-specific release/update/licensing code, bundled desktop app assets, and any other file explicitly marked with the desktop license
- free use of the official app, including internal commercial use
- source inspection
- local/private evaluation builds and personal patches
- no redistribution of the app or modified versions without written permission
- no publication of derivative desktop apps without written permission
- no resale, sublicensing, marketplace repackaging, renamed/forked public builds, bundled distribution, or commercial wrapping without written permission
- no removal/bypass/modification of license reminders in redistributed versions
- no trademark/branding rights beyond truthful reference
- third-party dependencies remain under their own licenses
- warranty and liability disclaimer
- governing law placeholder
- contribution terms placeholder

Avoid vague language that could chill legitimate MIT-core use. In particular, do not prohibit "substantially similar apps" without narrowing the wording to copies or derivative works of the covered desktop app.

## Migration Notes

- Prior MIT releases remain available under MIT.
- Future code can be licensed differently by the copyright holder, but outside MIT contributions may complicate relicensing.
- Git history should be audited before switching. Visible authorship is not a complete legal audit; check non-owner commits, co-authors, copied snippets, generated files, vendored assets, and app icon/source assets.
- Add a changelog or release note explaining the license boundary change.
- Tag or document the last repo-wide MIT version, for example `vX.Y.Z-last-mit`, if the project wants a crisp historical boundary.
- Consider contribution policy before accepting outside contributions:
  - MIT areas can likely use inbound=outbound or a DCO.
  - Non-MIT desktop areas should require a CLA or explicit contributor agreement if the project wants clean proprietary/source-available distribution rights.
  - A DCO alone is not a CLA and does not grant broad future relicensing rights.
- Add file-level SPDX headers gradually, starting where the boundary matters:
  - `SPDX-License-Identifier: MIT`
  - `SPDX-License-Identifier: LicenseRef-doc2md-Desktop`
- Define `LicenseRef-doc2md-Desktop` in `docs/licensing.md`.
- If the Mac app bundles MIT internal code or third-party dependencies, ship/preserve required notices. A maintained `apps/macos/THIRD_PARTY_NOTICES.md` is a good first step.

## Validation Checklist

- `README.md` no longer says the entire project is MIT.
- root `package.json` no longer says the mixed private workspace is MIT.
- `packages/core/package.json` still says MIT.
- `packages/core` has a package-local license pointer.
- `apps/macos` has a package-local desktop license pointer.
- `docs/licensing.md` explains the boundary in plain English.
- Generated/release artifacts and app icons are not accidentally presented as MIT if the intent is all rights reserved or desktop-license-covered.
- No source file gains contradictory license headers.
- License docs use actual repo paths: `apps/macos`, not `apps/mac`.
- A final release checklist is included before public release.
- The plan includes an explicit contribution/provenance audit step before relicensing existing desktop files.
- The root `LICENSE` no longer presents the whole repo as MIT.
- The Mac-app distribution preserves required notices for bundled MIT code and third-party dependencies.

## Release Review Questions

- Is a custom desktop shareware/source-available license preferable to an existing source-available license for this exact app model?
- Are restrictions on redistribution, derivative desktop apps, commercial repackaging, and reminder bypass drafted narrowly enough?
- Can all current `apps/macos/` code be relicensed by the project owner, or are there outside contributor concerns?
- Should contributions to non-MIT areas require a CLA, DCO, or explicit contributor terms?
- Is a last all-MIT tag/release note legally useful, and what exact wording should it use?
- Should app icons/screenshots/branding be handled by trademark notices, copyright notices, or both?
- Which governing law and venue should be used?
- How should historical MIT releases/tags be documented?
- Should `src/desktop/` be non-MIT now, or remain MIT until desktop web code can be cleanly separated from shared app code?
