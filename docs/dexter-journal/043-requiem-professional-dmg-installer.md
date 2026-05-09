# 043 - Requiem: Professional DMG Installer
<!-- quest-id: professional-dmg-installer_2026-04-30__1835 -->
<!-- pr: pending -->
<!-- style: requiem -->
<!-- quality-tier: gold -->
<!-- date: 2026-05-09 -->

The dangerous part of a professional DMG is that it looks harmless.

The Finder background, the Applications shortcut, the icon positions, the window size: all of that matters because users should not need folklore to install an app. But none of it was the real risk. The real risk lived in the release path, where a mounted image, a half-successful detach, and a forgiving shell could quietly turn "looks packaged" into "we shipped a corpse with nice stationery."

Reviewer B found the right body: `detach_mount` ended with `|| true`. That made cleanup look successful even when both normal and forced detach failed. Before UDZO conversion, that is not cosmetic. It is the kind of lie that survives every happy-path screenshot and waits for a release machine to make it expensive.

The fix was appropriately small. Let detach failure propagate. Fail the self-test if the mounted volume cannot be detached. Keep the trap path populated until cleanup actually succeeds. The system should be allowed to scream before it preserves a bad artifact.

What I would keep watching:

- release mode must keep proving the DMG itself, not just the app inside it;
- notarization scripts should fail on ambiguous `notarytool`, `stapler`, or `spctl` output;
- AppleScript layout should stay bounded, observable, and disposable if Finder gets theatrical;
- local unsigned builds must remain useful without teaching anyone to ignore release validation;
- the runbook should be treated as release equipment, not documentation garnish.

Judgment call: this quest earns confidence because it separated presentation from trust. Local builds make the installer look right. Protected release builds make it admissible in front of Gatekeeper. Blurring those two would have been convenient, and convenience is where release engineering usually hides the knife.

Remember the pattern: a polished artifact still needs a hostile self-test. Pretty folders do not testify.

- Dexter
