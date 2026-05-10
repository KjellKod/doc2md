# DMG AppleScript Failure Runbook

## Symptom

`scripts/release/package_mac_dmg.sh` exits non-zero while applying the Finder layout, or local `npm run build:dmg` prints:

```text
WARNING: Finder layout AppleScript failed; producing icon-only DMG. See docs/runbooks/dmg-applescript-failure.md.
```

Release-mode failures include the AppleScript retry output in the build log and GitHub Step Summary. A release DMG must not silently ship without the branded Finder layout.

## Causes

- macOS runner image regression or changed Finder behavior.
- Finder state pollution from a previous job or stuck mounted volume.
- Mounted-volume path or volume-name mismatch.
- AppleScript syntax or Finder dictionary behavior changed after a macOS update.
- Local machine Automation permissions block Finder scripting.

## Triage

1. Rerun once if the failure looks transient.
2. Inspect the AppleScript stderr line and attempt number in the build log or Step Summary.
3. Compare the runner macOS version with the last green release run.
4. Reproduce locally with the same `VERSION` so the volume name matches CI.
5. Check for stale mounted `doc2md` volumes and detach them before rerunning.

## Mitigations

- If Finder is consistently slow on a new runner image, adjust the bounded retry constants in `scripts/release/package_mac_dmg.sh` and keep the overall ceiling explicit.
- For local-only investigation, reduce icon size or temporarily inspect an icon-only DMG.
- Keep the background asset at `apps/macos/dmg/doc2md-dmg-background.png` and verify AppleScript uses the mounted-volume `.background` path.
- Track persistent runner-specific failures in an issue instead of weakening release validation.

## Escalation

Open an issue tagged `release-pipeline` with the release run URL, macOS runner version, AppleScript output, and the package script diff. If a release is time-critical, revert to a previous known-green packaging commit. Do not ship a plain release DMG by bypassing the release-mode AppleScript failure.
