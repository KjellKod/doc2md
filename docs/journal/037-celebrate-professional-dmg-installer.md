# 037 — Celebration: Professional DMG Installer
<!-- quest-id: professional-dmg-installer_2026-04-30__1835 -->
<!-- pr: pending -->
<!-- style: celebration -->
<!-- quality-tier: gold -->
<!-- date: 2026-05-09 -->

```
██████╗ ███╗   ███╗ ██████╗     ██████╗  ██████╗ ██╗     ██╗███████╗██╗  ██╗
██╔══██╗████╗ ████║██╔════╝     ██╔══██╗██╔═══██╗██║     ██║██╔════╝██║  ██║
██║  ██║██╔████╔██║██║  ███╗    ██████╔╝██║   ██║██║     ██║███████╗███████║
██║  ██║██║╚██╔╝██║██║   ██║    ██╔═══╝ ██║   ██║██║     ██║╚════██║██╔══██║
██████╔╝██║ ╚═╝ ██║╚██████╔╝    ██║     ╚██████╔╝███████╗██║███████║██║  ██║
╚═════╝ ╚═╝     ╚═╝ ╚═════╝     ╚═╝      ╚═════╝ ╚══════╝╚═╝╚══════╝╚═╝  ╚═╝
```

# Polished DMG, Validated DMG

## Starring Cast

| Role | Model | Credit |
|---|---|---|
| planner | GPT-5.5 | The Layout Cartographer |
| plan-reviewer-a | Claude | The Boundary Critic |
| plan-reviewer-b | GPT-5.5 | The Acceptance Auditor |
| arbiter | Claude (Jean-Claude) | The Sharpener |
| builder | GPT-5.5 | The Two-Script Surgeon |
| code-reviewer-a | Claude | The Line-Number Verifier |
| code-reviewer-b | GPT-5.5 | The Detach-Failure Catcher |
| fixer | GPT-5.5 | The Trap-State Preserver |

## Achievements Unlocked

🎨 **Branded Window That Communicates Install** — DMG opens with `doc2md.app` left, `Applications` shortcut right, branded background behind both. The Finder window is no longer a folder dump; it tells the user what to do.

📁 **Asset Lives Outside The Bundle** — `apps/macos/dmg/doc2md-dmg-background.png` sits sibling to the Xcode project, not under it. Zero references in `project.pbxproj`. Direct `test ! -e` assertion guards `doc2md.app/Contents/Resources/` from accidental bundling. The artwork is packaging, not runtime.

⏱ **AppleScript That Cannot Hang** — pinned numbers, not vibes. 30 seconds per `osascript` invocation. 3 retries. 2 second sleeps. 90 second overall ceiling. Release-mode fail loud with stderr in build log AND GitHub Step Summary; local dry-run falls back to icon-only with a stderr warning so a dev-machine Finder hiccup never blocks `npm run build:dmg`.

🪤 **Trap That Actually Catches** — fixer pass closed the silent-detach risk. `detach_mount` propagates failure. Both call sites hard-fail before clearing `SELF_TEST_MOUNT` / `RW_MOUNT`, so the EXIT trap retains the mount path for one more cleanup attempt. UDZO conversion can no longer happen with the source DMG still mounted.

🔍 **Mount Self-Test In Both Modes** — every freshly-built DMG attaches read-only, asserts `doc2md.app` and `Applications` at the volume root, and detaches under a trap. AC1/AC2 regressions fail at packaging time, not at human inspection.

🪖 **Two Scripts, Split Responsibilities** — `package_mac_dmg.sh` handles packaging + DMG signing + dry-run + self-test. `notarize_mac_dmg.sh` handles notarytool submit + status parse + log fetch on non-Accepted + staple + validate + `spctl --assess --type open --context context:primary-signature --verbose=4` with hard fail. Mirrors the existing `sign_mac_app.sh` + `notarize_mac_app.sh` separation. Both invoked explicitly from `release-mac.yml`.

📜 **Runbook For The Failure That Will Happen** — `docs/runbooks/dmg-applescript-failure.md` documents symptom, likely causes, triage, mitigations, and escalation before CI ever sees a Finder hiccup. Linked from `apps/macos/README.md` so it surfaces when needed.

🛡 **Secret Boundary Held** — no new repository-level Apple/Sparkle secrets. No `pull_request_target`. `package-mac` still pinned to `environment: mac-release`. `security_ci_guard.py` clean.

## Impact Metrics

- 2 plan iterations: one initial Codex pass, one re-plan after `/sharpen` surfaced seven resolved decisions.
- 1 fix iteration: closed `arb-rev-it0-01` (detach-failure semantics) in 5-10 surgical lines.
- 16 acceptance criteria, all addressed; AC9 marked `covered-manual` for clean-Mac validation.
- 0 new secrets added. 0 PR workflows touched. 0 third-party DMG helpers introduced.
- Handoff.json compliance for this session: 12/12 (100%) — every agent in iter-2 plan, build, code review iter 0, fix iter 1, code review iter 1, and arbiter routes used structured handoff files.

## Handoff And Reliability Snapshot

- Planner, both plan reviewers, plan arbiter, builder, both code reviewers, code arbiter, fixer, and re-review all produced `handoff.json`.
- One text-fallback in the prior iter-1 plan arbiter run (pre-this-session); replaced cleanly in iter-2 with structured handoff.
- Final canonical review backlog: `items: []`, all decision counts at zero.

## Quality Tier: Gold

Not Diamond because Reviewer B caught a real release-correctness bug at code review. The `|| true` on `detach_mount` would have eventually shipped a UDZO image converted from a still-mounted source — a low-frequency, high-blast-radius hazard. Earns Gold because: the sharpen pass surfaced the right seven decisions before the builder touched anything, the fix was scoped to ten lines and matched the arbiter directive verbatim, scope discipline held (Reviewer A's four nits stayed filtered), and both reviewers re-approved with `next: null` after the fix.

## Victory Narrative

This quest started with a working but plain DMG and a notarization gap that was tolerable in private but unacceptable as a public artifact. The plan was good. The sharpen pass made it better — particularly the asset-location decision (out of the Xcode target tree, not "exclude from Copy Bundle Resources" hand-waving) and the script split (mirroring the existing app pattern instead of inventing a new shape).

The most important moment was Reviewer B's must-fix at code review iter 0. `detach_mount` ending in `|| true` looked harmless in isolation; following the call sites revealed that a silent detach failure would lead directly into `hdiutil convert` with the source still mounted. Reviewer A approved cleanly because the surface read fine. The model diversity earned its keep here. The fixer made the smallest correct change, did not refactor the trap, did not touch the unrelated notarize script. That is what scope discipline looks like.

The runbook is the part the Builder should not need yet — until they do. AppleScript automation is timing-sensitive and Apple does not version Finder behavior the way a sane API would. Having a documented response to "the AppleScript timed out in CI" before the first such alert means whoever picks up the page knows where to look and what to try.

## Watch List For The Next Agent

- The PNG at `apps/macos/dmg/doc2md-dmg-background.png` is committed but I have not personally seen it rendered in a mounted DMG window. The plan's MANUAL TEST covers it; the next person to run `npm run build:dmg` should confirm the layout looks branded, the icons sit where the AppleScript places them, and the window size is reasonable. If the image is unreadable at 128px icon size, redo the artwork before release.
- `spctl --assess --type open --context context:primary-signature --verbose=4` is the documented invocation for the DMG. If a future macOS runner image deprecates this flag set, the release will fail loudly. That is the correct outcome — do not log-and-ship.
- The runbook at `docs/runbooks/dmg-applescript-failure.md` is the canonical place to update when a real CI failure produces new evidence. Keep it tight; do not let it grow into a wishlist.
- Reviewer A flagged four low-severity nits that were filtered out of this quest (plist-parse leak edge case, build-log noise on AppleScript happy path, status diagnostic specificity, sleep-arithmetic style). They were filtered because they are not release blockers, not because they are wrong. If a future quest is already touching `package_mac_dmg.sh`, those are reasonable hygiene fixes to roll in.
- The user reported a `"The operation can't be completed because you don't have permission to access some of the items."` Finder error during a manual test. That symptom is consistent with quarantine attributes on an unsigned local DMG — expected for `npm run build:dmg` output, not expected for the release DMG. If it appears on the release DMG, something is wrong upstream of `xcrun stapler validate`.

> "Detach cleanly before continuing; keep the trap as a safety net."
>
> — The plan, line 92. The fixer pass is what made the script actually obey both halves of that sentence.

— Jean-Claude, who likes a DMG that looks like an installer and a script that admits when it failed
