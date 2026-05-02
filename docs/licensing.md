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

# What Is Source-Visible Shareware?

The Mac desktop app in `apps/macos/` is source-visible shareware. It is not open source and is not MIT.

You may inspect the source, use the official app for free, use it for internal commercial work, and make private local evaluation builds or personal patches under the doc2md Desktop Shareware License.

You need written permission to redistribute the Mac app, sell it, sublicense it, commercially repackage it, publish derivative desktop apps, publish renamed or forked public builds, bundle it into another product, or reuse doc2md branding in a way that suggests endorsement or causes confusion.

See:

- `apps/macos/LICENSE`
- `LICENSES/LicenseRef-doc2md-Desktop.txt`

## What The Desktop License Does Not Restrict

The desktop license does not limit independent use of MIT-licensed doc2md components. You can use, copy, modify, publish, distribute, sublicense, and sell MIT-covered parts such as `@doc2md/core`, `packages/core/`, and the MIT-covered root `src/` under the MIT License terms.

## Branding

The doc2md name, app icons, screenshots, trade dress, domain names, and product branding are not licensed for reuse except where explicitly stated. Do not use them in a way that suggests endorsement or creates confusion with the official doc2md project.

## Third-Party Dependencies And Notices

Third-party dependencies remain under their own licenses.

The Mac app may bundle MIT-licensed internal doc2md code and third-party dependencies. Required notices must travel with the distributed app where applicable. See `apps/macos/THIRD_PARTY_NOTICES.md`.

## Prior MIT Releases

Prior versions that were released under MIT remain available under MIT. The project cannot claw back MIT rights already granted for those versions.

Future releases may use this mixed-license model. The maintainer may choose to tag or document the last repo-wide MIT version, for example `vX.Y.Z-last-mit`, but this quest does not create that tag.

## SPDX Guidance

Use SPDX headers where file-level clarity matters:

```text
SPDX-License-Identifier: MIT
```

```text
SPDX-License-Identifier: LicenseRef-doc2md-Desktop
```

The custom `LicenseRef-doc2md-Desktop` text lives at `LICENSES/LicenseRef-doc2md-Desktop.txt`.

Do not add broad file headers mechanically. Add them where the boundary matters or when new files are created in a licensed area.

## Contribution And Provenance Notes

Before publishing paid desktop distribution terms, confirm project ownership records for:

- non-owner commits
- co-authors and AI assistance trailers
- copied snippets
- generated files
- vendored assets
- app icon/source assets
- third-party notices
- future contributor terms

MIT areas may continue with inbound-equals-outbound or a Developer Certificate of Origin if the maintainer chooses. Non-MIT desktop areas such as `apps/macos/` should require a CLA or explicit contributor agreement before accepting outside contributions, or the project should avoid outside contributions there.

## Questions For Legal Review

- Is the custom desktop shareware license language enforceable and appropriately narrow?
- Which jurisdiction should replace the `[JURISDICTION]` placeholder?
- Are the redistribution, derivative desktop app, commercial repackaging, reminder-integrity, and branding restrictions drafted correctly?
- Can all current `apps/macos/` code and assets be covered by the desktop license?
- What contributor agreement should apply to future non-MIT desktop contributions?
- What exact notice inventory should ship with signed DMG releases?
