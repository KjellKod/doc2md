# 043 — Celebration: UX Improvements v2
<!-- quest-id: ux-improvements-v2_2026-05-14__2154 -->
<!-- pr: unavailable-no-pr-yet -->
<!-- style: celebration -->
<!-- quality-tier: Tin -->
<!-- date: 2026-05-15 -->

```
██╗   ██╗██╗  ██╗
██║   ██║╚██╗██╔╝
██║   ██║ ╚███╔╝
██║   ██║ ██╔██╗
╚██████╔╝██╔╝ ██╗
 ╚═════╝ ╚═╝  ╚═╝

██╗   ██╗██████╗
██║   ██║╚════██╗
██║   ██║ █████╔╝
╚██╗ ██╔╝██╔═══╝
 ╚████╔╝ ███████╗
  ╚═══╝  ╚══════╝
```

# UX Improvements v2

Quest ID: `ux-improvements-v2_2026-05-14__2154`

🎉 The desktop app now remembers its saved Markdown session without confusing that memory for permission to read the world. The compact toolbar keeps the important controls visible. The preview gets useful vertical space on launch. Mobile no longer treats the preview like an afterthought. The final menu clipping issue got a small, exact fix and a test to keep it fixed.

## Starring Cast

| Role | Agent |
|---|---|
| `planner [GPT-5.5]` | The Contract Cartographer |
| `plan-reviewer-a [Claude]` | The Native Trust Critic |
| `plan-reviewer-b [GPT-5.5]` | The Layout Criteria Auditor |
| `arbiter [Claude]` | The Boundary Setter |
| `builder [GPT-5.5]` | The Session Restorer |
| `code-reviewer-a [Codex fallback]` | The Overflow Witness |
| `code-reviewer-b [GPT-5.5]` | The Second Pass Sentinel |
| `fixer [GPT-5.5]` | The Clipped Menu Surgeon |

## Achievements Unlocked

⭐️ **Native Memory, Native Permission** — `session.json` stores saved Markdown restore candidates without turning WebView-supplied paths into disk-read authority.

⭐️ **One Recent List to Rule the Menu** — the in-app recent menu now reflects `NSDocumentController`, matching macOS Open Recent instead of maintaining a second truth.

⭐️ **Compact Chrome That Still Works** — Open, New, and theme controls survive working mode without burying the toggle.

⭐️ **Preview Space Reclaimed** — desktop and mobile preview sizing now starts from the viewport instead of making the user drag first.

⭐️ **The Final Clip** — active working-mode overflow is visible for the recent menu while inactive/collapsed transitions remain clipped, and the CSS contract is locked by test.

## Impact Metrics

📊 `session.json` split out from `settings.json` so restore state and preferences stop sharing a drawer.

🔒 Native trust filtering applies at session write and path open.

🧪 Validation covered Vitest component/desktop flows, typecheck, lint, Vite build, Xcode tests through the full Xcode path, and `npm run build:mac`.

📱 Mobile preview height now has a real floor instead of collapsing into unused space.

⚙️ Final review backlog: zero actionable items.

## Handoff & Reliability Snapshot

| Signal | Result |
|---|---|
| Plan iterations | 2 |
| Fix iterations | 3 |
| Structured handoffs | 19 / 21 |
| Claude handoffs | 5 / 5 |
| Codex handoffs | 14 / 16 |
| Final backlog | Empty |

The two text fallbacks both happened at the end, after the useful work had already been done: one artifact-write boundary through the worktree `.quest` symlink, one timeout with a clean fallback review. Not elegant, but honest, and the state machine still had receipts.

## Quality Tier: Tin 🥫

Tin is not glamorous. Tin is what you get when a high-risk native/web/UI quest needs two plan passes, three fix iterations, and one final artifact recovery. It is dented, labeled, and entirely useful.

> "Iteration 3 correctly fixes active working-mode clipping and preserves inactive/collapsed clipping behavior."
>
> — Code Reviewer B, final re-review

## Victory Narrative

This quest proved that the Mac app can remember without over-trusting, simplify recents without duplicating state, and make the working UI more humane without a design-system detour. The best part is not that the final fix was tiny. The best part is that the final fix could be tiny because the plan forced the trust boundary and layout criteria to become testable before the builder touched the code.

— Jean-Claude, who is not often impressed but is today
