# 040 — Celebration: Working-Mode Chrome
<!-- quest-id: working-mode-chrome_2026-05-12__1730 -->
<!-- pr: #122 -->
<!-- style: celebration -->
<!-- quality-tier: Platinum -->
<!-- date: 2026-05-12 -->

```
██╗  ██╗███████╗██████╗  ██████╗
██║  ██║██╔════╝██╔══██╗██╔═══██╗
███████║█████╗  ██████╔╝██║   ██║
██╔══██║██╔══╝  ██╔══██╗██║   ██║
██║  ██║███████╗██║  ██║╚██████╔╝
╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝ ╚═════╝

███████╗████████╗███████╗██████╗ ███████╗
██╔════╝╚══██╔══╝██╔════╝██╔══██╗██╔════╝
███████╗   ██║   █████╗  ██████╔╝███████╗
╚════██║   ██║   ██╔══╝  ██╔═══╝ ╚════██║
███████║   ██║   ███████╗██║     ███████║
╚══════╝   ╚═╝   ╚══════╝╚═╝     ╚══════╝

 █████╗ ███████╗██╗██████╗ ███████╗
██╔══██╗██╔════╝██║██╔══██╗██╔════╝
███████║███████╗██║██║  ██║█████╗
██╔══██║╚════██║██║██║  ██║██╔══╝
██║  ██║███████║██║██████╔╝███████╗
╚═╝  ╚═╝╚══════╝╚═╝╚═════╝ ╚══════╝
```

🎉 🎉 🎉 🎉  🙌  🎉 🎉 🎉 🎉

## Quest

**working-mode-chrome_2026-05-12__1730** → PR [#122](https://github.com/KjellKod/doc2md/pull/122) → branch `smooth-ux-top`

Finally, the editor gets the whole stage. The hero, the eyebrow, the format chips, the long supported-formats paragraph, all of it steps aside the moment a real file is selected. The logo holds the door open back to landing, and the one-shot sidebar guard from Phase 1 stays consumed across the roundtrip exactly as it should.

---

## 🎭 Starring Cast

| Role | Model | Specialized Label |
|------|-------|-------------------|
| planner | Codex gpt-5.5 | The Symbol-Naming Architect |
| plan-reviewer-a | Claude Opus 4.7 | The A Plan Critic |
| plan-reviewer-b | Codex gpt-5.5 | The B Plan Critic |
| arbiter | Claude Opus 4.7 | The Tie-Caller |
| builder | Codex gpt-5.5 | The Lifted-Input Engineer |
| code-reviewer-a | Claude Opus 4.7 | The A Code Critic |
| code-reviewer-b | Codex gpt-5.5 | The B Code Critic |
| fixer | (not summoned) | The Unneeded Bench Player |

---

## 🏆 Achievements Unlocked

⭐️ **F1 to F5 Survivor (Codex)**, five concrete must-fix items raised by the arbiter on iter 1, all resolved on iter 2 with named symbols, named test cases, and explicit constraints.

⭐️ **Single Source of Truth Defender (Codex)**, exactly two `setShowLandingChrome` callsites in the whole repo: one effect-scoped clearer, one Home-affordance setter. Drop, URL, browse, Recent, scratch paths all defer to the central effect.

⭐️ **One-Shot Guard Guardian (Claude + Codex)**, `firstAutoCollapseFiredRef` and `userTouchedSidebarRef` preserved across the Home roundtrip in both shells. The proof is behavioral: open A, collapse, Home, re-expand, open B, panel **stays** expanded. Asserted in Vitest in both shells AND in Playwright.

⭐️ **Smoothness Pact (Codex)**, `display: none` banned. `max-height` + `opacity` + `visibility` + `inert` + 200ms ease-out instead. `prefers-reduced-motion` overrides to 0ms. The branch is named `smooth-ux-top` for a reason; the smoothness was honored.

⭐️ **Mirror Discipline (Codex)**, every hosted state, handler, effect, JSX node, and CSS rule mirrored in `DesktopApp.tsx`. Zero parity gaps in code review.

⭐️ **Zero Fix Loops (both reviewers)**, both code reviewers approved on the first pass. No fixer agent dispatched. The plan iterations did the work the fix loop usually does.

⭐️ **Recent Without Regret (Codex)**, Mac Recent popover with focus trap, ESC close + focus return, ArrowUp/Down navigation, Tab wrap, outside-click dismiss, AND aria-haspopup gated on `recentFiles.length > 0`. Existing settings popover Recent list left strictly display-only.

⭐️ **Lifted Input Discipline (Codex)**, single visually-hidden `<input type="file">` in `App.tsx`; both DropZone browse AND WorkingModeBar Open route through `handleBrowserOpenRequest`. `BROWSER_FILE_ACCEPT` exported once. No duplicated picker code.

---

## 🎯 Impact Metrics

📊 **11 files changed, +1166 / -37** (3 new: `WorkingModeBar.tsx`, `WorkingModeBar.test.tsx`, `working-mode-chrome.spec.ts`)
🧪 **597 Vitest tests** green (61 files)
🧪 **51 Playwright tests** green
🎮 **6 new WorkingModeBar specs** covering aria-haspopup gating, ESC + focus return, Tab wrap, arrow nav, plain-button empty path, Home callback
🎮 **4 new e2e specs** covering bar replaces hero, Home returns with entries, Home roundtrip no re-fire, scratch stays in landing
🪞 **2 shells mirrored** with identical derivation, central effect, refs, and JSX shape
🎨 **200ms ease-out** with 0ms reduced-motion fallback
🔁 **2 plan iterations, 0 fix iterations**, the planner did the work upfront

---

## 📡 Handoff & Reliability Snapshot

- Handoffs parsed: 9 (planner ×2, plan-reviewer-a ×2, plan-reviewer-b ×2, arbiter ×2, builder, code-reviewer-a, code-reviewer-b)
- Findings tracked end-to-end: 5 plan must-fixes (iter 1) → all resolved iter 2; 2 code-review info notes → both `decision: drop`, captured as forward-looking follow-ups
- Stability signal: every handoff was `handoff_json=found` on first read; zero text-fallback parses
- Orchestrator slip: dual plan reviewers were dispatched **serially** on iter 1 instead of in one parallel message; logged to `parallelism.log` as a retrospective note. Iter 2 and code review were dispatched concurrently.

---

## 💎 Quest Quality Score: PLATINUM 🏆

Two plan iterations to converge, zero fix iterations after build, both code reviewers approved on first pass, all five validation gates green, two info-only forward-looking notes that nobody pretended were blockers. Not quite Diamond, the iter-1 plan needed concrete substitution for `display: none` and a real Home-roundtrip proof, but everything after iter 2 was clean. Honest A.

---

## 📜 Quote from the Quest

> "Approve. All plan invariants F1 to F5, one-shot guard preservation, desktop parity, CSS smoothness, test rigor, and a11y docs verified. Two info-level forward-looking notes only."
>
> Code Reviewer A, final verdict

---

## 🚀 Victory Narrative

The proposal asked for a two-mode layout six months ago. Phase 1 shipped sidebar auto-collapse and stopped, the hero, the format chips, the supported-formats paragraph, the Home affordance, the Recent popover, all of it deferred. The follow-up quest closed the gap surgically: no editor engine swap, no compact-view toggle, no settings, no scope creep. The app reads what state you're in and adjusts. The logo never forgets where home is. The cursor finally gets the whole stage.

What this quest proved: a plan that gets honest dual review can absorb five must-fix items in one revision pass and still ship without a single fix iteration. The work the fixer usually does, the planner did.

**Victory Unlocked!** 🎮

Jean-Claude, who is not often impressed but is today
