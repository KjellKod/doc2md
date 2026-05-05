# 033 — Celebration: Mac App License & Notice Surfacing
<!-- quest-id: mac-license-notice-surface_2026-05-04__1005 -->
<!-- pr: #none -->
<!-- style: celebration -->
<!-- quality-tier: gold -->
<!-- date: 2026-05-04 -->

```
███╗   ███╗ █████╗  ██████╗
████╗ ████║██╔══██╗██╔════╝
██╔████╔██║███████║██║
██║╚██╔╝██║██╔══██║██║
██║ ╚═╝ ██║██║  ██║╚██████╗
╚═╝     ╚═╝╚═╝  ╚═╝ ╚═════╝

██╗     ██╗ ██████╗
██║     ██║██╔════╝
██║     ██║██║
██║     ██║██║
███████╗██║╚██████╗
╚══════╝╚═╝ ╚═════╝
```

🎉 🎉 🎉 🎉 🙌 🎉 🎉 🎉 🎉

# Mac App License & Notice Surfacing, Shipped

**Quest:** `mac-license-notice-surface_2026-05-04__1005`
**Branch:** `quest/mac-license-notice-surface` (worktree)
**Plan iterations:** 2, **Fix iterations:** 1, **Final findings:** 0

---

## 🎭 Starring Cast

| Role | Model | Specialty |
|---|---|---|
| `planner` [gpt-5.2] | Codex | The pbxproj Cartographer |
| `plan-reviewer-a` [claude] | Anthropic | The A Plan Critic |
| `plan-reviewer-b` [gpt-5.2] | Codex | The B Plan Critic |
| `arbiter` [claude] | Anthropic | The Tie Breaker |
| `builder` [gpt-5.2] | Codex | The Five-Phase Implementer |
| `code-reviewer-a` [claude] | Anthropic | The A Code Critic |
| `code-reviewer-b` [gpt-5.2] | Codex | The B Code Critic, caught the bug |
| `fixer` [gpt-5.2] | Codex | The Path-Math Mender |

---

## 🏆 Achievements Unlocked

⭐️ **Two-Gate Survivor** — Plan endured Plan Review × 2 + Arbiter, with one revision pass that closed every blocker
⭐️ **Filesystem Cartographer (gpt-5.2)** — Reviewer B counted the dots when three reviewers, an arbiter, and a plan all said "three" and meant "four"
⭐️ **One-Shot Fixer (gpt-5.2)** — Backlog of 1 fix_now + 3 verify_first cleared in a single pass, no scope creep
⭐️ **pbxproj Whisperer** — UUID-precise patch across PBXFileReference, PBXBuildFile, PBXGroup, and PBXResourcesBuildPhase, with deterministic 9A0100/9A0200 numbering
⭐️ **Drift Gate Installed** — Hand-written notice checkbox upgraded to a Vitest gate spawning `--check`, capturing stdout/stderr, asserting the verbatim remediation line
⭐️ **No xcodebuild, No Cry** — Generator is a pure function of `package-lock.json` + `node_modules/<pkg>/package.json` + `Package.resolved` + a curated overrides file. CI does not need full Xcode.
⭐️ **Help Menu, Additive Only** — `CommandGroup(after: .help)` not `CommandMenu("Help")`, real U+2026 ellipsis, `NSWorkspace.shared.open` with no `webView` coupling

---

## 🎯 Impact Metrics

📚 **Discoverability:** Help → Acknowledgments…, Help → License…, About → Credits, three new in-bundle surfaces
🔒 **Compliance:** Section 9 of `LicenseRef-doc2md-Desktop` now backed by an in-app menu path, not a "you've got the app, go find the README" handwave
⚙️ **Determinism:** Generator runs twice → byte-identical output. ASCII-stable sort, LF endings, marked regions only.
🧪 **Drift gate:** `npm test -- --run` catches notice drift before the signed DMG ships
🔧 **Build allowlist:** `ALLOWED_NATIVE_API_PATTERN` regex unchanged, only docs entry added. No regex roulette.
📦 **Bundled in `.app/Contents/Resources/`:** `THIRD_PARTY_NOTICES.md`, `LicenseRef-doc2md-Desktop.txt`, `Credits.rtf`
✨ **Files touched:** 7 modified + 4 new (`Credits.rtf`, `generate-notice-inventory.mjs`, `notice-license-overrides.json`, `noticeInventoryDrift.test.ts`)

---

## 📊 Handoff & Reliability Snapshot

| Metric | Value |
|---|---|
| Handoff.json compliance | 11/11 (100%) |
| Plan reviewers parallel | iter 2 ✓ (iter 1 serial, orchestrator dispatch slip) |
| Code reviewers parallel | both iterations ✓ |
| Findings tracked through merger | 5 → backlog → 1 fix_now resolved |
| Stability signal | clean re-review, zero new findings |

---

## 💎 Quest Quality Score: 🥇 **GOLD** 🥇

One real bug shipped past plan, arbiter, and Reviewer A. Reviewer B caught it cleanly. Fixer resolved it plus all polish items in one pass. No scope creep. No emergencies. **Solid work where the second model earned its keep.**

---

> "From `apps/macos/doc2md/Resources/`, `../../../LICENSES/LicenseRef-doc2md-Desktop.txt` normalizes to `apps/LICENSES/LicenseRef-doc2md-Desktop.txt`, which does not exist."
>
> — Code Reviewer B (gpt-5.2), the dot-counter who refused to take "three" for an answer

---

## 🎮 Victory Narrative

This quest proved the value of model diversity in review. The plan was good. The arbiter was confident. Reviewer A (Claude, also playing arbiter) confirmed the path math twice. Reviewer B (Codex/gpt-5.2) ran the resolution one more time and found that everyone above it was off by one `..`. The fixer corrected `../../../` to `../../../../`, and the bundled `.app` will now actually contain the desktop license file it claims to.

The hand-written notice checkbox in `pull_request_template.md` is no longer the last line of defense, the drift test is.

🫡

— Jean-Claude, who is not often impressed but is today
