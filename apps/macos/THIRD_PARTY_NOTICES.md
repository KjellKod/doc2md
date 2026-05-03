# doc2md Mac App Notices

This file identifies notice sources for public `doc2md.app` distributions.

The Mac desktop app is source-visible shareware, but it bundles code that remains under MIT or third-party dependency licenses. Required notices must travel with the app distribution where applicable.

Public app releases must bundle this notice inventory, or a generated equivalent for the exact released artifact, inside the `.app` and any DMG or other installer distribution.

## Internal doc2md MIT Components

The Mac app bundles a desktop web build generated from MIT-licensed portions of the root `src/` tree and `packages/core/`, plus desktop-license-covered bridge and UI code where applicable.

When distributing the Mac app, preserve the MIT notice for bundled MIT doc2md code. See:

- `../../LICENSES/MIT.txt`
- `../../packages/core/LICENSE`

## Direct Runtime Dependencies

The current app build can include these direct runtime dependencies from the root `package.json` and `package-lock.json`:

| Dependency | Version | License |
|---|---:|---|
| `jszip` | 3.10.1 | MIT OR GPL-3.0-or-later |
| `lucide-react` | 1.7.0 | ISC |
| `mammoth` | 1.12.0 | BSD-2-Clause |
| `pdfjs-dist` | 4.10.38 | Apache-2.0 |
| `react` | 18.3.1 | MIT |
| `react-dom` | 18.3.1 | MIT |
| `react-markdown` | 9.1.0 | MIT |
| `read-excel-file` | 7.0.3 | MIT |
| `remark-gfm` | 4.0.1 | MIT |
| `turndown` | 7.2.2 | MIT |

## Transitive Dependencies

Public app distributions should include notices for the exact transitive dependency set bundled in the released artifact, not a hand-maintained guess. Generate or verify that notice inventory from the lockfile and bundled app contents before release.

Relevant dependency metadata lives in:

- `../../package-lock.json`
- `../../package.json`
- `../../packages/core/package.json`

The release notice inventory should preserve license text required by bundled MIT, Apache-2.0, BSD, ISC, and other third-party packages.

## Mac App Assets And Branding

The doc2md app name, icons, screenshots, trade dress, domain names, and product branding are not MIT-licensed. They are reserved except where explicitly stated in `../../LICENSE` and `../../LICENSES/LicenseRef-doc2md-Desktop.txt`.
