# doc2md Licensing Guide

This guide explains the repository's mixed-license model in plain English.

## Summary

doc2md has two goals:

1. Keep the conversion engine, package/CLI, hosted web app, and shared web code MIT-licensed and easy to trust.
2. Make the Mac desktop app source-visible shareware so users can inspect it while the project can protect the paid desktop distribution, branding, update path, and app-specific assets.

## What Is MIT?

The following areas are licensed under the MIT License unless a more specific file says otherwise:

- `packages/core/`, including `@doc2md/core` and its CLI
- root `src/`, including the hosted web app, shared converters, and current desktop bridge React code
- tests, examples, scripts, and documentation related to the MIT-licensed components

See `LICENSES/MIT.txt` and `packages/core/LICENSE`.

The first published desktop release keeps `src/desktop/` and the desktop-specific sections currently embedded in `src/App.tsx` under MIT. This is an intentional boundary decision: code shared by the desktop app, the core npm package, and the hosted web app remains MIT, as described in these license docs. Keeping shared code under one clear license avoids confusing file-level splits while the Mac-specific native app code remains covered by the desktop shareware license.

## What Is Source-Visible Shareware?

The Mac desktop app in `apps/macos/` is source-visible shareware. It is not open source and is not MIT.

You may inspect the source, use the official app as an unregistered evaluation version with no fixed trial period, use it for internal commercial work, and make private local evaluation builds or personal patches under the doc2md Desktop Shareware License.

If you continue using the official app after evaluation, you must purchase a license. A registered license removes evaluation reminders. Conversion features are not artificially disabled in the unregistered evaluation version.

Private local modifications and local evaluation builds may be used only for personal or internal evaluation. They may not be distributed, published, sold, sublicensed, hosted, bundled, or provided to others without written permission.

## What Requires Written Permission

You need written permission before you:

- **Redistribute** the Mac desktop app or modified versions of it.
- **Sell, sublicense, or commercially repackage** the Mac desktop app.
- **Publish derivative desktop apps** based on the Mac desktop app.
- **Publish renamed or forked public builds** of the Mac desktop app.
- **Bundle the Mac desktop app** into another product or service.
- **Use the Mac desktop app** to offer a public or third-party conversion service.
- **Reuse doc2md branding** in a way that suggests endorsement or causes confusion with the official project.

See:

- `apps/macos/LICENSE`
- `LICENSES/LicenseRef-doc2md-Desktop.txt`

For licensing questions or written-permission requests, contact Kjell Hedstrom at `kjell@candidtalentedge.com` or through the project repository at `https://github.com/kjellkod/doc2md`.

## What The Desktop License Does Not Restrict

The desktop license does not limit independent use of MIT-licensed doc2md components. You can use, copy, modify, publish, distribute, sublicense, and sell MIT-covered parts such as `@doc2md/core`, `packages/core/`, and the MIT-covered root `src/` under the MIT License terms.

## Branding

The doc2md name, app icons, screenshots, trade dress, domain names, and product branding are not licensed for reuse except where explicitly stated. Do not use them in a way that suggests endorsement or creates confusion with the official doc2md project.

## Third-Party Dependencies And Notices

Third-party dependencies remain under their own licenses.

The Mac app may bundle MIT-licensed internal doc2md code and third-party dependencies. Required notices must travel with the distributed app where applicable. See `apps/macos/THIRD_PARTY_NOTICES.md`.

## Prior MIT Releases

Prior versions that were released under MIT remain available under MIT. The project cannot claw back MIT rights already granted for those versions.

The current mixed-license model applies to future releases unless a later release states a different license boundary. Any last repo-wide MIT release should be identified in release notes or tags when that history matters to users.

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

Contributions to non-MIT desktop areas, including `apps/macos/`, are submitted under the desktop license unless separately agreed in writing. The project may decline contributions to those areas when the licensing boundary or ownership terms are unclear.
