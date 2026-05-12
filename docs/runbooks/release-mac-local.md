# Runbook: Local Signed Mac Release

How to produce a fully signed, notarized, and stapled `doc2md.dmg` on a maintainer's local machine, end to end, without going through the protected `mac-release` GitHub workflow.

> [!IMPORTANT]
> **This runbook is for local evaluation, debugging, and pre-release validation only.**
>
> doc2md's Mac desktop app is **source-visible shareware**, not open source. The doc2md Desktop Shareware License (`LICENSES/LicenseRef-doc2md-Desktop.txt`) permits private local builds for personal or internal evaluation. It does **not** permit distributing, publishing, selling, sublicensing, hosting, bundling, or providing locally-built copies for internal company use, clients or other third parties. Productive use of any copy other than the official release requires written permission from the project owner.
>
> Producing a Developer-ID-signed and Apple-notarized DMG locally produces an artifact that **looks** authoritative to Gatekeeper. Releasing such an artifact under the doc2md name without authorization is a license violation, brand-confusion problem, and a breach of trust with users who rely on the official release path. The canonical public release is the artifact produced by the protected `release-mac` GitHub workflow run against a tagged commit, and only that artifact is approved for distribution.
>
> See `docs/licensing.md` and `apps/macos/LICENSE` for the full terms.

## When to use this runbook

Use the local pipeline when you need to:

- **Validate the release plumbing end to end** before pushing a release tag (e.g., confirming `notarize_mac_dmg.sh` works against a real Apple notary submission).
- **Debug a release-CI failure** that you cannot reproduce in a workflow run.
- **Smoke-test a Developer-ID-signed app** locally on a clean Mac to confirm Gatekeeper acceptance, drag-install, and launch behavior before tagging.
- **Verify a Sparkle update** signs correctly end-to-end before the workflow exercises it.

Use the GitHub `release-mac` workflow (`gh workflow run release-mac.yml --ref main -f tag=X.Y.Z`) for any artifact you intend to publish. The protected workflow is the only path that produces a release-approved DMG.

## Prerequisites

| Requirement | How to verify |
|---|---|
| macOS with full Xcode | `xcodebuild -version` |
| Node.js + npm + project dependencies installed | `npm ci` from repo root |
| Pinned `dmgbuild` installed with `pipx` | see code block below |
| `gh` authenticated as you | `gh auth status` |
| Apple Developer ID Application certificate **in your login Keychain** | see code block below |
| App Store Connect API key (`.p8` file) saved on disk | `ls -l "$APPLE_NOTARY_API_KEY_PATH"` |
| App Store Connect Key ID and Issuer ID at hand | https://appstoreconnect.apple.com/access/api |

To verify the Developer ID Application certificate is present in your login Keychain (the table cell above cannot hold this command unescaped because of the embedded pipe):

```bash
security find-identity -v -p codesigning | grep "Developer ID Application"
```

If the Developer ID certificate is not in your Keychain yet, import it from Apple Developer (Certificates → Developer ID Application → Download → double-click the `.cer` to install). The `.p8` notary key can only be downloaded once at creation time; if you have lost it, generate a new one in App Store Connect.

Install the pinned DMG packaging tool from the repo root so the constraints path is absolute:

```bash
python3 -m pip install --user pipx
python3 -m pipx ensurepath
export PIPX_HOME="${PIPX_HOME:-$HOME/.local/share/pipx}"
python3 -m pipx install "dmgbuild==1.6.7" --pip-args "--constraint $PWD/requirements-mac-release.txt"
"$PIPX_HOME/venvs/dmgbuild/bin/python" -c "import ds_store, mac_alias"
```

## Environment variables

The script `scripts/release/release_mac_local.sh` requires these four variables. If any is missing it prints a per-variable hint and exits without touching anything.

```bash
# Replace the placeholder values with your actual values.
# DO NOT commit a populated copy of this snippet to the repository.

export CODESIGN_IDENTITY="Developer ID Application: Your Name (TEAMID)"
export APPLE_NOTARY_API_KEY_PATH="$HOME/.private_keys/AuthKey_XXXXXXXXXX.p8"
export APPLE_NOTARY_API_KEY_ID="XXXXXXXXXX"
export APPLE_NOTARY_API_ISSUER_ID="00000000-0000-0000-0000-000000000000"
```

| Variable | What it is | Where to find it |
|---|---|---|
| `CODESIGN_IDENTITY` | Identity string of the cert in your Keychain. | Output of `security find-identity -v -p codesigning`. Use the exact quoted name including the team ID in parentheses. |
| `APPLE_NOTARY_API_KEY_PATH` | Path to your App Store Connect `.p8` file. | Wherever you saved the file at key creation time. Common convention: `~/.private_keys/AuthKey_XXX.p8` with `chmod 600`. Do not commit. |
| `APPLE_NOTARY_API_KEY_ID` | 10-character key ID shown next to the `.p8` in App Store Connect. | https://appstoreconnect.apple.com/access/api |
| `APPLE_NOTARY_API_ISSUER_ID` | UUID issuer ID for your team. | Top of the App Store Connect API keys page. |

`VERSION` is optional; if unset the script reads `CFBundleShortVersionString` from `apps/macos/doc2md/Info.plist`.

## Run the pipeline

```bash
./scripts/release/release_mac_local.sh
```

The script prints a numbered progress line for each of the six steps:

1. Building Release Mac app
2. Signing app with `$CODESIGN_IDENTITY`
3. Notarizing + stapling app (1-3 min waiting on Apple)
4-5. Packaging polished DMG and signing
6. Notarizing + stapling + validating DMG (1-3 min waiting on Apple)

Total time: roughly 5-8 minutes on a recent Mac, dominated by two notarytool round trips.

## Success criteria

When the script finishes you should see:

```
Done. Signed/notarized/stapled DMG ready at:
       .build/release/doc2md-<VERSION>.dmg
```

Re-validate any time with the three commands below. All three must exit `0`:

```bash
codesign --verify --strict --verbose=2 .build/release/doc2md-<VERSION>.dmg
xcrun stapler validate .build/release/doc2md-<VERSION>.dmg
spctl --assess --type open --context context:primary-signature --verbose=4 .build/release/doc2md-<VERSION>.dmg
```

For a true end-to-end Gatekeeper test, copy the DMG to a different Mac that has never seen these credentials, mount it, drag-install to `/Applications`, and launch. A correctly notarized DMG installs and launches without any Gatekeeper prompts about an unidentified developer.

## Cleanup

The script leaves your environment as it was. To be tidy:

```bash
unset CODESIGN_IDENTITY APPLE_NOTARY_API_KEY_PATH APPLE_NOTARY_API_KEY_ID APPLE_NOTARY_API_ISSUER_ID
```

The signed DMG remains at `.build/release/doc2md-<VERSION>.dmg`. Delete it when you no longer need it. Per the license terms, do not distribute or publish locally-built signed artifacts.

## What never gets committed

Do not commit any of the following to the repository, ever:

- The `.p8` notary key file or its contents.
- A populated copy of the four environment variables above with real values.
- The Developer ID Application `.p12` certificate or its passphrase.
- Any signed DMG produced by this pipeline.
- Sparkle EdDSA private keys (committed builds embed the public key only).

`.gitignore` already excludes `.build/`, so locally produced DMGs cannot be committed accidentally. Notary keys should live in `~/.private_keys/` or another path outside the repo.

## Troubleshooting

**`CODESIGN_IDENTITY not found in any keychain`**
The string in the env var must exactly match the identity name printed by `security find-identity -v -p codesigning`, including the team ID in parentheses. Spaces, punctuation, and case all matter.

**`xcrun notarytool submit` returns `Invalid` or `Rejected`**
Run `xcrun notarytool log <submission-id> --key-id ... --issuer ... --key ...` to see Apple's specific objections. Common causes: hardened runtime not enabled on the app, missing entitlements, embedded binaries unsigned, timestamp server unreachable when signing. The notarize scripts already pull `notarytool log` automatically when status is non-`Accepted`.

**Headless DMG packaging fails**
`package_mac_dmg.sh` uses pinned `dmgbuild` in both local dry-run and release mode. Missing `dmgbuild`, invalid JSON settings, missing `.DS_Store`, background mismatches, stale mounts, and codesign preservation failures are blocking. See `docs/runbooks/dmg-packaging-failure.md` for the full triage path.

**`spctl` exits non-zero on the validated DMG**
Different macOS versions accept different `spctl` invocations. The script uses `--type open --context context:primary-signature --verbose=4`, which is the documented Apple recommendation. If it fails on a runner image that has changed behavior, treat as a real failure: do not ship the DMG, file an issue, and revert to a previous known-green packaging commit until the runner is understood.

**`release_mac_local.sh` exits with `Missing required environment variables`**
The script prints which ones are missing and what each is for. Set them and re-run. The script does no work until all four are present.

## Related

- `apps/macos/README.md` — Sparkle plumbing, Mac release workflow overview, validation commands.
- `docs/runbooks/dmg-packaging-failure.md` — Headless dmgbuild packaging failure triage.
- `.github/workflows/release-mac.yml` — The protected GitHub workflow that produces the canonical public release artifact.
- `docs/licensing.md` — Full licensing guide.
- `LICENSES/LicenseRef-doc2md-Desktop.txt` — Mac desktop shareware license terms.
