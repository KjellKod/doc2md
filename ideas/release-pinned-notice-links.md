# Release-Pinned Notice Links

Status: active
Owner: maintainers

## Problem

`apps/macos/THIRD_PARTY_NOTICES.md` is bundled into the Mac app and shown in the app-owned `Third-Party Licenses` window. Repository paths in that file should be useful when read from inside the app, so they should be full GitHub URLs. For released apps, those URLs should also point at the exact release source, not the moving `main` branch.

Manually editing the notice file from `main` to `vX.Y.Z` during every release is easy to forget and creates release-process friction.

## Goal

Make release-pinned notice links automatic.

Dev builds can keep pointing at `main`; release builds should generate the bundled notice file with a release ref such as `v2.2.2` without requiring a manual edit.

## Expected Behavior

- The checked-in `apps/macos/THIRD_PARTY_NOTICES.md` can keep stable developer-friendly URLs, likely `https://github.com/KjellKod/doc2md/blob/main/...`.
- `scripts/generate-notice-inventory.mjs` accepts a release ref input, for example `DOC2MD_RELEASE_REF=v2.2.2`.
- When `DOC2MD_RELEASE_REF` is present, generated repository URLs use:
  - `https://github.com/KjellKod/doc2md/blob/${DOC2MD_RELEASE_REF}/...`
- When the env var is absent, generated repository URLs use `main`.
- `scripts/build-mac-app.sh` passes the release ref into notice generation automatically when it can infer one from the build/release context.
- The release workflow should not require a human to edit `THIRD_PARTY_NOTICES.md` for version/tag URLs.

## Implementation Notes

- Add a small URL helper in `scripts/generate-notice-inventory.mjs`:
  - `const releaseRef = process.env.DOC2MD_RELEASE_REF?.trim() || "main";`
  - `githubBlobPath("package-lock.json") -> https://github.com/KjellKod/doc2md/blob/${releaseRef}/package-lock.json`
- Keep all generated and hand-written repo references in `THIRD_PARTY_NOTICES.md` flowing through that helper where practical.
- For release builds, prefer the canonical tag format used by the repo, likely `vX.Y.Z`.
- Do not require a committed diff just to move notice URLs from `main` to a release tag.

## Acceptance Criteria

- `DOC2MD_RELEASE_REF=v2.2.2 npm run generate:notices` produces GitHub blob URLs pinned to `v2.2.2`.
- `npm run generate:notices` without the env var produces GitHub blob URLs pinned to `main`.
- The committed notice drift test continues to pass for the default developer path.
- A focused test covers the release-ref URL substitution without requiring a real release tag.
- The Mac Release build path bundles the generated notice file with the release ref when the release ref is available.
- No manual release checklist step is required to edit `apps/macos/THIRD_PARTY_NOTICES.md` URLs.

## Scope

IN:
- Notice URL helper and tests.
- Build-script wiring for `DOC2MD_RELEASE_REF`.
- README/release-doc note explaining the automatic behavior.

OUT:
- Changing license text.
- Changing third-party dependency inventory semantics.
- Requiring a protected workflow edit unless the existing release workflow cannot expose a tag/ref to the build script.

## Priority

Small follow-up. This is not a blocker for local development, but it is the right polish before signed release artifacts are treated as source-accurate legal bundles.
