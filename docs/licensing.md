# doc2md Licensing Guide

This guide explains the repository's mixed-license model in plain English.

## Summary

doc2md has two goals:

1. Keep the conversion engine, package/CLI, hosted web app, and shared web code MIT-licensed and easy to trust.
2. Make the Mac desktop app source-visible shareware so users can inspect it while the project can protect the paid desktop distribution, branding, update path, and app-specific assets.

## What Is MIT?

The following areas are licensed under the MIT License unless a more specific file or section says otherwise:

- `packages/core/`, including `@doc2md/core` and its CLI
- hosted web app code, shared converters, and root `src/` files or sections that are not marked or documented as desktop-specific desktop app code
- tests, examples, scripts, and documentation related to the MIT-licensed components

See `LICENSES/MIT.txt` and `packages/core/LICENSE`.

Desktop-specific UI and bridge code is covered by the desktop shareware license when it is in `apps/macos/`, `src/desktop/`, `src/types/doc2mdShell.d.ts`, or otherwise marked with `SPDX-License-Identifier: LicenseRef-doc2md-Desktop`. Shared hosted-web and converter code remains MIT.

## What Is Source-Visible Shareware?

The Mac desktop app is source-visible shareware. It is not open source and is not MIT, except for bundled MIT Components that keep their own MIT terms.

You may inspect the source, use the official app as an unregistered evaluation version with no fixed trial period, use it for internal commercial work, and make private local evaluation builds or personal patches under the doc2md Desktop Shareware License.

Evaluation means good-faith assessment of whether the official app meets your needs. If you decide to keep using the official app, or use it for ongoing productive work after evaluation, you must purchase a license. A registered license removes evaluation reminders. Conversion features are not artificially disabled in the unregistered evaluation version.

Private local modifications and local evaluation builds may be used only for personal or internal evaluation. For organizations, internal evaluation covers employees or contractors evaluating the app for that organization's own use. Private builds and patches may not be distributed, published, sold, sublicensed, hosted, bundled, provided to clients or other third parties, or used as a third-party service without written permission.

## What Requires Written Permission

You need written permission before you:

- **Redistribute** the Mac desktop app or modified versions of it.
- **Sell, sublicense, or commercially repackage** the Mac desktop app.
- **Publish derivative desktop apps** based on the Mac desktop app.
- **Publish renamed or forked public builds** of the Mac desktop app.
- **Bundle the Mac desktop app** into another product or service.
- **Use the Mac desktop app** to offer a public, client-facing, or third-party conversion service.
- **Reuse doc2md branding** in a way that suggests endorsement or causes confusion with the official project.

See:

- `apps/macos/LICENSE`
- `LICENSES/LicenseRef-doc2md-Desktop.txt`

For licensing questions or written-permission requests, contact the project owner Kjell Hedström at `kjell@candidtalentedge.com` or through the project repository at `https://github.com/kjellkod/doc2md`. GitHub issues, pull requests, comments, reviews, and discussions are request channels only. They are not written permission unless Kjell Hedström expressly identifies the response as written permission under the desktop license and signs or otherwise authenticates that grant.

## What The Desktop License Does Not Restrict

The desktop license does not limit independent use of MIT-licensed doc2md components. You can use, copy, modify, publish, distribute, sublicense, and sell MIT-covered parts such as `@doc2md/core`, `packages/core/`, hosted web app code, shared converters, and MIT-marked files under the MIT License terms.

## Branding

The doc2md name, app icons, screenshots, trade dress, domain names, and product branding are not licensed for reuse except where explicitly stated. Do not use them in a way that suggests endorsement or creates confusion with the official doc2md project.

## Third-Party Dependencies And Notices

Third-party dependencies remain under their own licenses.

The Mac app may bundle MIT-licensed internal doc2md code and third-party dependencies. Required notices must travel with the distributed app where applicable. Public app releases must bundle or otherwise ship the notice inventory for the exact released artifact. See `apps/macos/THIRD_PARTY_NOTICES.md`.

## Prior MIT Releases

Versions before commit `4efd6d1` were published under the prior repo-wide MIT license. Those prior MIT permissions remain available for those earlier versions. The project cannot claw back MIT rights already granted for those versions.

The current mixed-license model applies to Covered Software from commit `4efd6d1` and later, unless a later release states a different license boundary.

## SPDX (Software Package Data Exchange) Guidance

Use SPDX headers where file-level clarity matters:

```text
SPDX-License-Identifier: MIT
```

```text
SPDX-License-Identifier: LicenseRef-doc2md-Desktop
```

The custom `LicenseRef-doc2md-Desktop` text lives at `LICENSES/LicenseRef-doc2md-Desktop.txt`.

Do not add broad file headers mechanically. Add them where the boundary matters or when new files are created in a licensed area.

## Contributions

Contributions to MIT-licensed areas are accepted under the same MIT terms.

Contributions to non-MIT desktop areas, including `apps/macos/`, `src/desktop/`, and other desktop-license-marked files, are submitted under the desktop license unless separately agreed in writing. The project may require a separate contributor agreement or explicit inbound-rights confirmation before accepting contributions to those areas, and may decline contributions when licensing boundary or ownership terms are unclear.
