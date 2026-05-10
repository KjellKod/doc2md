# Quest Journal: Professional DMG Installer

- Quest ID: `professional-dmg-installer_2026-04-30__1835`
- Slug: professional-dmg-installer
- Completed: 2026-05-09
- Mode: workflow
- Quality: Gold
- Outcome: Make the Mac DMG installer professional and release-ready. Current state: - `npm run build:dmg` builds an unsigned local DMG through `scripts/build-mac-dmg.sh`. - `scripts/release/package_mac_dmg.s...

## What Shipped

**Problem**: `npm run build:dmg` currently produces a valid but plain folder-style DMG. The protected Mac release workflow signs and notarizes `doc2md.app`, then creates and signs a DMG, but the DMG itself is not explicitly notarized, stapled, and validated as the public distribution artifact.

*...

## Files Changed

- `.quest/professional-dmg-installer_2026-04-30__1835/phase_01_plan/plan.md`
- `.quest/professional-dmg-installer_2026-04-30__1835/phase_01_plan/arbiter_verdict.md`
- `.quest/professional-dmg-installer_2026-04-30__1835/phase_01_plan/review_findings.json`
- `.quest/professional-dmg-installer_2026-04-30__1835/phase_01_plan/review_backlog.json`
- `.quest/professional-dmg-installer_2026-04-30__1835/phase_01_plan/review_plan-reviewer-a.md`
- `.quest/professional-dmg-installer_2026-04-30__1835/phase_01_plan/review_plan-reviewer-b.md`
- `.github/workflows/release-mac.yml`
- `apps/macos/README.md`
- `apps/macos/dmg/README.md`
- `apps/macos/dmg/doc2md-dmg-background.png`
- `docs/runbooks/dmg-applescript-failure.md`
- `scripts/release/package_mac_dmg.sh`
- `scripts/release/notarize_mac_dmg.sh`
- `.quest/professional-dmg-installer_2026-04-30__1835/phase_02_implementation/pr_description.md`
- `.quest/professional-dmg-installer_2026-04-30__1835/phase_02_implementation/builder_feedback_discussion.md`
- `.quest/professional-dmg-installer_2026-04-30__1835/phase_02_implementation/handoff.json`
- `.quest/professional-dmg-installer_2026-04-30__1835/phase_03_review/arbiter_verdict.md`
- `.quest/professional-dmg-installer_2026-04-30__1835/phase_03_review/review_findings.json`
- `.quest/professional-dmg-installer_2026-04-30__1835/phase_03_review/review_backlog.json`
- `.quest/professional-dmg-installer_2026-04-30__1835/phase_03_review/review_code-reviewer-a.md`
- `.quest/professional-dmg-installer_2026-04-30__1835/phase_03_review/review_findings_code-reviewer-a.json`
- `.quest/professional-dmg-installer_2026-04-30__1835/phase_03_review/review_code-reviewer-b.md`
- `.quest/professional-dmg-installer_2026-04-30__1835/phase_03_review/handoff_fixer.json`

## Iterations

- Plan iterations: 2
- Fix iterations: 1

## Agents

- **The Judge** (arbiter): 
- **The Implementer** (builder): 

## Quest Brief

Make the Mac DMG installer professional and release-ready.

Current state:
- `npm run build:dmg` builds an unsigned local DMG through `scripts/build-mac-dmg.sh`.
- `scripts/release/package_mac_dmg.sh` currently stages only `doc2md.app` and creates a basic compressed DMG with `hdiutil`.
- The resulting DMG opens like a plain folder containing the app, not a polished drag-to-Applications installer.
- The protected release workflow already has signing/notarization plumbing for the app and release assets, but we need to verify and tighten the full distribution story.

Goal:
Create a professional macOS drag-install DMG for `doc2md.app`, and ensure the release path produces Apple Developer ID signed, notarized, stapled, Gatekeeper-valid artifacts.

Expected changes:
1. Update the DMG packaging flow so the mounted DMG has:
   - `doc2md.app`
   - an `/Applications` symlink or alias
   - a clear visual layout where users understand to drag `doc2md.app` into Applications
   - stable Finder icon positions
   - a reasonable window size
   - a simple branded background image if practical, committed as a source asset
2. Keep `npm run build:dmg` simple for local unsigned smoke builds.
3. Keep protected release CI responsible for public signed/notarized artifacts.
4. Review the existing release pipeline and decide whether the DMG itself should also be signed, notarized, and stapled in addition to the contained app. Implement the correct Apple Developer ID distribution flow.
5. Ensure the release DMG passes local validation with:
   - `codesign --verify`
   - `spctl --assess`
   - `xcrun stapler validate` where applicable
   - mount/open/install smoke checks
6. Update `apps/macos/README.md` so there is one clear local command and one clear protected release path.

Constraints:
- Do not introduce signing secrets into PR workflows.
- Do not use `pull_request_target`.
- Do not expose Apple or Sparkle secrets outside the protected `mac-release` Environment.
- Keep local `npm run build:dmg` usable without Apple credentials.
- Prefer built-in macOS tooling if it stays maintainable. If using a third-party DMG helper, justify it and pin/install it safely.
- Keep the change focused on DMG presentation and release validity, not licensing/payment.

Acceptance criteria:
- `npm run build:dmg` creates a local DMG that opens with a professional drag-to-Applications layout.
- The DMG contains `doc2md.app` and an Applications shortcut.
- The local DMG build still auto-derives the version.
- Release CI produces a signed/notarized/stapled distribution artifact that Gatekeeper accepts on a clean Mac.
- Documentation explains local unsigned DMG builds vs protected public release builds.
- Existing Mac app build and release smoke checks still pass.

Validation:
- Run `bash -n scripts/build-mac-app.sh scripts/build-mac-dmg.sh scripts/release/package_mac_dmg.sh`.
- Run `npm run build:dmg` and manually inspect the mounted DMG layout.
- Run the existing Mac release build/smoke checks where available.
- For signed release validation, document exact commands and run them if credentials/environment are available.
- Run `python3 scripts/security_ci_guard.py` if any workflow changes are made.

## Carry-Over Findings

- No carry-over findings this round; nothing was inherited from earlier quests and nothing needs to be saved for the next one.

## Celebration

This journal embeds the celebration payload used by `/celebrate`.

- [Jump to Celebration Data](#celebration-data)
- Replay locally: `/celebrate docs/quest-journal/professional-dmg-installer_2026-05-09.md`

## Celebration Data

<!-- celebration-data-start -->
```json
{
  "quest_mode": "workflow",
  "agents": [
    {
      "name": "arbiter",
      "model": "",
      "role": "The Judge"
    },
    {
      "name": "builder",
      "model": "",
      "role": "The Implementer"
    }
  ],
  "achievements": [
    {
      "icon": "[BUG]",
      "title": "Gremlin Slayer",
      "desc": "Tackled 10 review findings"
    },
    {
      "icon": "[TEST]",
      "title": "Battle Tested",
      "desc": "Survived 5 reviews"
    },
    {
      "icon": "[PLAN]",
      "title": "Plan Perfectionist",
      "desc": "Iterated plan 2 times"
    },
    {
      "icon": "[WIN]",
      "title": "Quest Complete",
      "desc": "All phases finished successfully"
    }
  ],
  "metrics": [
    {
      "icon": "📊",
      "label": "Plan iterations: 2"
    },
    {
      "icon": "🔧",
      "label": "Fix iterations: 1"
    },
    {
      "icon": "📝",
      "label": "Review findings: 5"
    }
  ],
  "quality": {
    "tier": "Gold",
    "grade": "G"
  },
  "inherited_findings_used": {
    "count": 0,
    "summaries": []
  },
  "findings_left_for_future_quests": {
    "count": 0,
    "summaries": []
  },
  "test_count": null,
  "tests_added": null,
  "files_changed": 23
}
```
<!-- celebration-data-end -->
