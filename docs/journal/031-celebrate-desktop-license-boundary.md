# 031 — Celebration: Desktop License Boundary Refactor
<!-- quest-id: desktop-license-boundary_2026-05-03__0954 -->
<!-- pr: unavailable-api-rate-limited -->
<!-- style: celebration -->
<!-- quality-tier: Tin -->
<!-- date: 2026-05-03 -->

```
██████╗  ██████╗ ██╗   ██╗███╗   ██╗██████╗
██╔══██╗██╔═══██╗██║   ██║████╗  ██║██╔══██╗
██████╔╝██║   ██║██║   ██║██╔██╗ ██║██║  ██║
██╔══██╗██║   ██║██║   ██║██║╚██╗██║██║  ██║
██████╔╝╚██████╔╝╚██████╔╝██║ ╚████║██████╔╝
╚═════╝  ╚═════╝  ╚═════╝ ╚═╝  ╚═══╝╚═════╝

██████╗  █████╗ ██████╗ ██╗   ██╗
██╔══██╗██╔══██╗██╔══██╗╚██╗ ██╔╝
██████╔╝███████║██║  ██║ ╚████╔╝
██╔══██╗██╔══██║██║  ██║  ╚██╔╝
██║  ██║██║  ██║██████╔╝   ██║
╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝    ╚═╝
```

# 🎉 Desktop License Boundary Refactor

Quest ID: `desktop-license-boundary_2026-05-03__0954`

The branch went into the refactor with desktop behavior living in shared rooms
and license text doing too much explanatory labor. It came out with a hard
hosted/desktop split, cleaner MIT surfaces, desktop-owned bridge behavior, and a
license story that no longer requires a reader to remember all the exceptions.

## Starring Cast

| Role | Agent |
|---|---|
| `planner [Codex]` | The Boundary Cartographer |
| `plan-reviewer-a [Claude]` | The A Plan Critic |
| `plan-reviewer-b [Codex]` | The B Plan Critic |
| `arbiter [Claude]` | The Anti-Spin Gatekeeper |
| `builder [Codex]` | The Code Mover |
| `code-reviewer-a [Claude]` | The A Code Critic |
| `code-reviewer-b [Codex]` | The B Code Critic |

## 🏆 Achievements Unlocked

⭐️ **Hard-Split Discipline** — Hosted `App.tsx` stopped importing desktop shell,
persistence, save/open/reveal, native menu, and desktop CSS behavior.

⭐️ **Desktop Root Claimed Its Name** — `src/desktop/main.tsx` and
`src/desktop/DesktopApp.tsx` now own the Mac-facing app composition.

⭐️ **CSS Boundary Cleanout** — Desktop selectors left `src/styles/global.css` and
moved into `src/desktop/desktop.css`.

⭐️ **License Text With Teeth** — Section 4 now keeps the evaluation-only model
instead of merely passing stale-language scans.

⭐️ **Contributor Routing Without a Wall** — The PR template asks the useful
questions without turning into a legal obstacle course.

## 🎯 Impact Metrics

📊 **444 tests passing** across the full Vitest suite.

🧪 **134 focused tests passing** across hosted, desktop, hook, and save-state
surfaces.

🔒 **Zero shared-boundary scan hits** for `doc2mdShell`, desktop imports,
persistence, reveal, save-as, desktop metadata, or desktop SPDX strings in
hosted/shared surfaces.

📦 **Mac app built successfully**, including the desktop web bundle and bundled
`THIRD_PARTY_NOTICES.md`.

📚 **License model clarified** across root license, custom desktop license,
licensing docs, README, and contribution template.

## Handoff & Reliability Snapshot

- Plan iterations: **4**
- Fix iterations: **0**
- Code review blockers: **0**
- Handoff route: structured `handoff.json` throughout after artifact repair
- Remaining human checks: manual Mac smoke and final legal interpretation

## 🥫 Quality Tier: Tin, Dented But Useful

Four plan iterations is not a Diamond stroll. It is a refactor that had to be
interrogated until the license boundary stopped moving under pressure. The
result is better for the dents.

> "Both plan reviewers cleared the iteration-4 plan."
>
> — Arbiter verdict, iteration 4

## Victory Narrative

This quest proved the useful thing: license clarity is architecture. You do not
get a clean desktop shareware model by sprinkling comments through shared files
and hoping contributors read them. You get it by making the import graph,
stylesheet ownership, tests, and docs all say the same thing.

Hosted code now reads like hosted code. Desktop code now lives where desktop code
belongs. The license says evaluation means evaluation, purchase means purchase,
and MIT components stay MIT.

— Jean-Claude, who is not often impressed but is today
