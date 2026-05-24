## Contribution Area

Check all that apply:

- [ ] MIT components: `packages/core/`, hosted web/shared converters, MIT-marked files
- [ ] Desktop shareware components: `apps/macos/`, `src/desktop/`, `src/types/doc2mdShell.d.ts`, desktop-specific UI/bridge code
- [ ] Documentation only
- [ ] Unsure

If unsure, open an issue first so we can help route the change.

Do not paste proprietary, client, or confidential content into this PR, comments, screenshots, logs, fixtures, or test documents.

If this PR touches desktop shareware components, I understand the project may require explicit contributor terms or written confirmation before accepting the contribution.

## Local Mac Validation

- [ ] I ran `npm run validate:local` locally.
- [ ] This PR does not touch Mac desktop, DMG, signing/notarization, Sparkle, or desktop-specific release paths.

For a maintainer PR that touches those paths:

- [ ] The `npm run validate:local` run included signed `npm run validate:mac` validation on macOS with Apple/Sparkle credentials available.

If credentials are intentionally unavailable:

- [ ] I ran `npm run validate:local -- --unsigned-only` and noted that a maintainer still needs to run the signed local Mac validation before merge.

## Mac Release Notices

- [ ] This PR does not tag or prepare a signed public Mac release.

For a signed public Mac release PR only:

- [ ] I verified the notice file bundled into the `.app` and DMG covers the exact released artifact, including JavaScript dependencies from `package-lock.json`, native SwiftPM/Xcode dependencies such as Sparkle, and any bundled MIT doc2md components.
