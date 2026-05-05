# 034 — Celebration: Mac License Notice Surface Correction
<!-- quest-id: mac-license-notice-surface-correction_2026-05-05__0445 -->
<!-- pr: #none -->
<!-- style: celebration -->
<!-- quality-tier: platinum -->
<!-- date: 2026-05-05 -->

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

███████╗██╗   ██╗██████╗
██╔════╝██║   ██║██╔══██╗
███████╗██║   ██║██████╔╝
╚════██║██║   ██║██╔══██╗
███████║╚██████╔╝██║  ██║
╚══════╝ ╚═════╝ ╚═╝  ╚═╝
```

# Mac License Notice Surface Correction, Completed

**Quest:** `mac-license-notice-surface-correction_2026-05-05__0445`
**Branch:** `quest/mac-license-notice-surface`
**Quality tier:** 🏆 **Platinum** — three plan iterations to get the contract precise, one fix pass, final dual review clean.

---

## 🎭 Starring Cast

| Role | Model | Credit |
|---|---|---|
| `plan-reviewer-a` [claude] | The A Plan Critic | Spotted the SPDX scope creep before it bloated the diff |
| `plan-reviewer-b` [gpt-5.5 via fallback] | The B Plan Critic | Kept the generated Swift file honest |
| `code-reviewer-a` [claude] | The A Code Critic | Found the commit override edge case and stale credits note |
| `code-reviewer-b` [gpt-5.5 via fallback] | The B Code Critic | Caught the AC10 scan scope mismatch |

---

## 🏆 Achievements Unlocked

⭐️ **About Became a Product Surface** — `About doc2md` now owns icon, metadata, release commit, Docs, GitHub, and Licenses.

⭐️ **Help Menu Reclaimed** — third-party legal text left Help; purchased-license and update workflows stayed there.

⭐️ **Native Notices, No External Editor** — bundled `THIRD_PARTY_NOTICES.md` now renders in a read-only app window.

⭐️ **Commit Provenance Embedded** — Release builds generate a Swift constant with a 7-character commit value and an `unknown` fallback.

⭐️ **One Fix Pass** — five review findings reduced to zero after one targeted fixer iteration.

---

## 📊 Impact Metrics

| Signal | Result |
|---|---|
| Vitest | 49 files / 455 tests passing |
| Release build | `BUILD SUCCEEDED` with PR development-license override |
| Bundle resources | `THIRD_PARTY_NOTICES.md` and `LicenseRef-doc2md-Desktop.txt` present |
| Review backlog | 5 findings → 0 after fixer + re-review |
| Diff hygiene | `git diff --check origin/main...HEAD` and working-tree diff clean |

---

## 🔒 Reliability Snapshot

Every bridge handoff landed as structured JSON. Plan review converged at iteration 3, builder completed, fixer completed, and the final re-review had empty findings from both reviewers.

> "Re-review pass after fixer iteration 1: backlog cleared, no new findings, tests and whitespace clean."
>
> — Code Reviewer B, final handoff

---

## 🎮 Victory Narrative

This quest corrected the branch against its own PR contract. The app no longer asks users to understand bundled legal files through the Help menu or their default Markdown editor. It presents licensing context where users expect it: an app-owned About surface, a native third-party licenses page, and a Help menu reserved for the license/status workflows people actually need while using the app.

The build passed. The reviewers went quiet for the right reason. That is the satisfying kind of silence.

— Jean-Claude, who is not often impressed but is today
