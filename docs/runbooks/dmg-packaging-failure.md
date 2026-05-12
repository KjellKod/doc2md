# DMG Packaging Failure Runbook

## Symptom

`scripts/release/package_mac_dmg.sh`, `npm run build:dmg`, `tests/release/test_dmg_layout.py`, or `scripts/release/check_dmg_determinism.sh` exits non-zero while creating or validating the drag-to-Applications DMG layout.

The packaging path is intentionally headless. Missing `dmgbuild`, invalid JSON settings, missing `.DS_Store`, background byte mismatches, stale mounts, and signed-app verification failures are blocking failures in both local dry-run and release mode.

## Local install precondition

Install the pinned tool from the repo root so the constraints path is absolute. On macOS, install `pipx` through Homebrew because system Python is PEP 668 externally-managed and refuses `pip install --user`:

```bash
brew install pipx              # idempotent
pipx ensurepath
pipx install "dmgbuild==1.6.7" --pip-args "--constraint $PWD/requirements-mac-release.txt"
"$(pipx environment --value PIPX_HOME)/venvs/dmgbuild/bin/python" -c "import ds_store, mac_alias"
```

If you already have `pipx` on `PATH` from a different installation method (Homebrew Python, a private venv), use it as-is rather than reinstalling.

Do not install `dmgbuild` into the system Python for release work.

## CI install failures

Check the `Install pinned dmgbuild` step first. It should set `PIPX_HOME=$RUNNER_TEMP/pipx`, set `PIPX_BIN_DIR=$RUNNER_TEMP/pipx-bin`, add the bin directory to `GITHUB_PATH`, install `dmgbuild==1.6.7` with `--constraint $GITHUB_WORKSPACE/requirements-mac-release.txt`, and verify `ds_store` plus `mac_alias` imports from the dmgbuild venv Python.

If resolution fails, compare the error against `requirements-mac-release.txt`. Do not remove the constraints to make CI green; update the pin only after confirming the new resolved version and recording why it changed.

## Invalid JSON settings

The committed source of truth is `apps/macos/dmg/dmgbuild-settings.json`. The package script renders it through `scripts/release/render_dmgbuild_settings.py` before invoking `dmgbuild`.

Common failures:

- Missing required keys: `title`, `background`, `icon-size`, `format`, `window`, or `contents`.
- `format` changed away from `UDZO`.
- Unresolved sentinel strings such as `__APP_PATH__`.
- App or background paths do not exist.

Run the renderer directly with a known app path to isolate schema errors.

## Layout metadata mismatches

Run the standalone layout test with the dmgbuild venv Python. Set `VERSION` to your build version first (literal `<version>` would be parsed as shell input redirection):

```bash
VERSION="2.3.3-dev"  # replace with your build version
"$PIPX_HOME/venvs/dmgbuild/bin/python" tests/release/test_dmg_layout.py ".build/release/doc2md-${VERSION}.dmg"
```

Failures identify the mismatched field, such as `bwsp.WindowBounds`, `icvp.iconSize`, `icvp.backgroundType`, `icvp.backgroundImageAlias`, `doc2md.app Iloc`, or `Applications Iloc`.

`ds_store` parse failures mean the DMG did not receive readable Finder metadata. `mac_alias` failures mean the background alias in `.DS_Store` does not decode to `.background.png`. Both are release blockers.

## Background path or byte mismatch

The accepted mounted background path is `.background.png` at the volume root. Its bytes must match `apps/macos/dmg/doc2md-dmg-background.png`.

Check both files after mounting:

```bash
VERSION="2.3.3-dev"  # replace with your build version
cmp apps/macos/dmg/doc2md-dmg-background.png "/Volumes/doc2md ${VERSION}/.background.png"
```

Do not change the artwork or the expected mounted path as a workaround.

## `hdiutil detach` retry exhaustion

The package script uses `dmgbuild --detach-retries 12`; tests and determinism checks retry normal detach and then force detach. If detach still fails, check for stale mounts:

```bash
VERSION="2.3.3-dev"  # replace with your build version
hdiutil info
hdiutil detach "/Volumes/doc2md ${VERSION}" || hdiutil detach -force "/Volumes/doc2md ${VERSION}"
```

Re-run after the stale mount is gone. Persistent detach failures are runner or OS issues; keep the blocking validation in place.

## Codesign preservation failure

When `CODESIGN_IDENTITY` is set, `mount_self_test` runs:

```bash
VERSION="2.3.3-dev"  # replace with your build version
codesign --verify --deep --strict --verbose=2 "/Volumes/doc2md ${VERSION}/doc2md.app"
```

If this fails, the signed app did not survive packaging intact. Do not continue to DMG signing or notarization. Confirm the input `.app` verifies before packaging, then inspect whether `dmgbuild` staging preserved resource forks and extended attributes.

## Escalation

Open an issue tagged `release-pipeline` with the workflow run URL, macOS runner version, failing command, relevant stderr, and package/test script diff. If a release is time-critical, revert to the last known-good packaging commit. Do not bypass the layout test, determinism check, `mount_self_test`, codesign verification, `spctl`, or stapler validation to ship a DMG.
