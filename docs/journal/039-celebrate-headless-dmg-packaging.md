# 039 — Celebration: headless-dmg-packaging
<!-- quest-id: headless-dmg-packaging_2026-05-11__2346 -->
<!-- pr: #116 -->
<!-- style: celebration -->
<!-- quality-tier: Gold -->
<!-- date: 2026-05-12 -->

```
██╗  ██╗███████╗ █████╗ ██████╗ ██╗     ███████╗███████╗███████╗
██║  ██║██╔════╝██╔══██╗██╔══██╗██║     ██╔════╝██╔════╝██╔════╝
███████║█████╗  ███████║██║  ██║██║     █████╗  ███████╗███████╗
██╔══██║██╔══╝  ██╔══██║██║  ██║██║     ██╔══╝  ╚════██║╚════██║
██║  ██║███████╗██║  ██║██████╔╝███████╗███████╗███████║███████║
╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝ ╚══════╝╚══════╝╚══════╝╚══════╝

██████╗ ███╗   ███╗ ██████╗
██╔══██╗████╗ ████║██╔════╝
██║  ██║██╔████╔██║██║  ███╗
██║  ██║██║╚██╔╝██║██║   ██║
██████╔╝██║ ╚═╝ ██║╚██████╔╝
╚═════╝ ╚═╝     ╚═╝ ╚═════╝
```

🎉 🎉 🎉 🎉   🍾   🎉 🎉 🎉 🎉

**Quest:** headless-dmg-packaging
**Quest ID:** `headless-dmg-packaging_2026-05-11__2346`
**PR slot:** #116 (even → Jean-Claude rises)

---

## 🎭 Starring Cast

| Role | Slot | Model | Specialty |
|------|------|-------|-----------|
| planner | sole | GPT-5 Codex (gpt-5.5) | The Architect |
| plan-reviewer-a | A | Claude Opus 4.7 (1M) | The A Plan Critic |
| plan-reviewer-b | B | GPT-5 Codex | The B Plan Critic |
| arbiter | sole | Claude Opus 4.7 (1M) | The Tie-Breaker |
| builder | sole | GPT-5 Codex | The Implementer |
| code-reviewer-a | A | Claude Opus 4.7 (1M) | The A Code Critic |
| code-reviewer-b | B | GPT-5 Codex | The B Code Critic |
| fixer | sole | GPT-5 Codex | The Hardener |

---

## 🏆 Achievements Unlocked

⭐️ **Demolition Specialist (Codex)** — Deleted 220 lines of fragile AppleScript machinery in one builder pass. Net package_mac_dmg.sh: **-176 lines**, more readable than the day it shipped.

🎯 **Tie-Breaker Triumph (Claude Arbiter)** — Resolved two real acceptance-criteria ambiguities the planner had punted to mid-build: `.background.png` (dmgbuild's native single-file emit) and parsed-record `.DS_Store` equality (the only honest determinism check when `mac_alias.Alias` encodes volume-create-time and CNID).

🔍 **Model Diversity Payoff (Codex Reviewer B)** — Caught two failure-path bugs Claude Reviewer A missed: opaque `struct.error` from `mac_alias.Alias.from_bytes(b"")` and silent stale-mount accumulation when `hdiutil detach -force` itself fails. **This is exactly what dual review is for.**

🔧 **One-Shot Fixer (Codex)** — Both Reviewer B findings closed in a single fix pass. Pytest, py_compile, and `bash -n` validation green. Iter 2 reviewers: zero findings, unanimous approve.

🥇 **Two-Round Knockout (Codex Planner × Claude Arbiter)** — Plan landed in 2 iterations of the 4-iteration budget. Arbiter rejected 13 nitpicks (mtime pinning, `--force` retry semantics, `.ws/` worktree handwringing) and kept only the 5 substantive blockers. KISS won the day.

🤝 **Cross-Runtime Handshake** — 14 agent invocations, 14 `handoff.json` files found, 0 fallbacks to text parsing. Claude and Codex talked through files like adults.

🧪 **Determinism Is Not A Vibe** — New CI gate compares parsed `.DS_Store` records and byte-cmp's the background PNG across two consecutive builds. No more "looks fine on my mac."

🪦 **Runbook RIP** — `docs/runbooks/dmg-applescript-failure.md` deleted. The runbook for handling the failure mode we just eliminated is itself eliminated. Closed-loop hygiene.

---

## 🎯 Impact Metrics

| Metric | Value |
|---|---|
| 📊 AppleScript lines removed | **220** |
| 📐 Net change to package_mac_dmg.sh | **-176 lines** |
| 🧪 New automated CI gates | **4** (layout test, determinism check, extended mount_self_test, codesign on mounted app) |
| 🔒 New TCC/Automation permissions required | **0** (was: 1 per build machine) |
| 📦 New pinned third-party deps | **3** (dmgbuild==1.6.7, ds_store==1.3.2, mac_alias==2.2.3) |
| 🚪 New `pull_request_target` triggers | **0** (security_ci_guard passes) |
| ⚡️ Plan iterations | **2** of 4 |
| 🔧 Fix iterations | **1** of 3 |
| 🐛 Reviewer findings tackled | **3** (1 arbiter consolidated set + 2 Reviewer B catches) |
| 🤖 Bridge handoffs parsed cleanly | **14 / 14** |

---

## 📡 Handoff & Reliability Snapshot

```
phase=plan          | planner       | runtime=codex  | iter=1 | handoff_json=found
phase=plan_review   | reviewer-a    | runtime=claude | iter=1 | handoff_json=found
phase=plan_review   | reviewer-b    | runtime=codex  | iter=1 | handoff_json=found
phase=plan_review   | arbiter       | runtime=claude | iter=1 | handoff_json=found
phase=plan          | planner       | runtime=codex  | iter=2 | handoff_json=found
phase=plan_review   | reviewer-a    | runtime=claude | iter=2 | handoff_json=found
phase=plan_review   | reviewer-b    | runtime=codex  | iter=2 | handoff_json=found
phase=plan_review   | arbiter       | runtime=claude | iter=2 | handoff_json=found
phase=building      | builder       | runtime=codex  | iter=1 | handoff_json=found
phase=code_review   | reviewer-a    | runtime=claude | iter=1 | handoff_json=found
phase=code_review   | reviewer-b    | runtime=codex  | iter=1 | handoff_json=found
phase=fixing        | fixer         | runtime=codex  | iter=1 | handoff_json=found
phase=code_review   | reviewer-a    | runtime=claude | iter=2 | handoff_json=found
phase=code_review   | reviewer-b    | runtime=codex  | iter=2 | handoff_json=found
```

Stability signal: **clean.** No retries, no Tier-B sandbox escalations, no text-handoff fallbacks.

---

## 🥇 Quest Quality Score: GOLD 🥇

Honest tier. Not Diamond (one fix iteration), not Platinum (the build phase needed a fix pass), but Gold for the right reasons:

- Plan converged in 2 iterations after a strong arbiter call
- Build was one-shot
- The fix loop closed cleanly, no scope creep, fixer touched exactly the four files Reviewer B named
- Final code review was a unanimous shrug of approval

---

## 📜 A Quote From the Quest

> "The dmg gods are appeased; the `.DS_Store` has been parsed in our favor."
>
> — Code Reviewer A (Claude), iter 2 final verdict

> "A small, dignified honesty that the release CI deserved from the start."
>
> — Code Reviewer A on the fix-pass detach hardening

> "Iteration 1: iterate, arbiter resolved AC1 (.background.png) and AC11 (parsed-record equality) and listed 5 blocking plan edits for the planner."
>
> — Arbiter (Claude), iter 1 verdict that turned the quest

---

## 🚀 Victory Narrative

Before this quest, `npm run build:dmg` was a *trust fall* with Finder. The build script asked Finder very politely (via AppleScript) to please open a read-write DMG, please drag the background image into place, please position the icons, please save `.DS_Store`. When the operating system said "no, I revoked your Automation permission three weeks ago," the script said "okay" and shipped a DMG with bare icons. The user discovered this by opening the artifact on a clean machine.

After this quest, `npm run build:dmg` does not ask Finder for anything. It calls `dmgbuild`, which writes `.DS_Store` directly via the same byte format Finder reads, no automation, no permission, no retry loop, no 90-second timeout, no `WARNING:` line in the logs that no one notices. The mount-and-assert test runs in CI on every Mac-touching PR, comparing parsed records and background bytes; the determinism check runs the same build twice and refuses to let them differ. The AppleScript runbook is deleted because the failure mode it documented no longer exists.

**The promised install experience is now the actual one — on every Mac, every build, every time.**

The dual-runtime model-diversity review caught two failure-path bugs that a single-model review would have shipped. Codex Reviewer B saw what Claude Reviewer A missed. Claude Arbiter saw what the Codex Planner punted. Codex Builder shipped what neither reviewer could have written alone. This is what the pipeline is supposed to do, and today it did exactly that.

**The DMG opens like a product. Finally.** 🎉

---

**Victory Unlocked.** 🎮

— Jean-Claude
