# Mac App Third-Party And Internal Notices

This file tracks notice guidance for the `doc2md.app` Mac distribution.

The Mac desktop app is source-visible shareware, but it may bundle code that remains under MIT or third-party dependency licenses. Those notices must travel with the app distribution where required.

## Internal doc2md MIT Components

The Mac app bundles a desktop web build generated from the root Vite/React app. For this quest, root `src/`, including `src/desktop/` and desktop-only code inside `src/App.tsx`, remains MIT.

When distributing the Mac app, preserve the MIT notice for bundled MIT doc2md code. See:

- `../../LICENSES/MIT.txt`
- `../../packages/core/LICENSE`

## Third-Party Dependencies

Third-party dependencies remain under their own licenses. Before public distribution, review the bundled app contents and dependency tree, then preserve required notices for bundled dependencies.

Relevant dependency metadata currently lives in:

- `../../package-lock.json`
- `../../package.json`
- `../../packages/core/package.json`

This file is maintained guidance, not a generated dependency report. A future release task may replace or supplement it with generated notices from the exact shipped bundle.

## Mac App Assets And Branding

The doc2md app name, icons, screenshots, trade dress, domain names, and product branding are not MIT-licensed. They are reserved except where explicitly stated in `../../LICENSE` and `../../LICENSES/LicenseRef-doc2md-Desktop.txt`.
