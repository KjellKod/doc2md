# 047 — Requiem: AppShell Dedup Phase 2
<!-- quest-id: appshell-dedup-phase-2_2026-05-16__1614 -->
<!-- pr: #135 -->
<!-- style: requiem -->
<!-- quality-tier: Gold -->
<!-- date: 2026-05-18 -->

```
██████╗ ██╗██████╗
██╔══██╗██║██╔══██╗
██████╔╝██║██████╔╝
██╔══██╗██║██╔═══╝
██║  ██║██║██║
╚═╝  ╚═╝╚═╝╚═╝

 █████╗ ██████╗ ██████╗
██╔══██╗██╔══██╗██╔══██╗
███████║██████╔╝██████╔╝
██╔══██║██╔═══╝ ██╔═══╝
██║  ██║██║     ██║
╚═╝  ╚═╝╚═╝     ╚═╝

███████╗██╗  ██╗███████╗██╗     ██╗
██╔════╝██║  ██║██╔════╝██║     ██║
███████╗███████║█████╗  ██║     ██║
╚════██║██╔══██║██╔══╝  ██║     ██║
███████║██║  ██║███████╗███████╗███████╗
╚══════╝╚═╝  ╚═╝╚══════╝╚══════╝╚══════╝
```

🕯️ ⚰️ 🦇 🌑 🦇 ⚰️ 🕯️

> _A requiem for the shell that finally stopped duplicating itself._

---

## 🪦 Epitaphs

```
    ┌───────────────────────────────────────────┐
    │                                           │
    │              R . I . P .                  │
    │                                           │
    │  Here lies `src/App.tsx`. It spent        │
    │  years hoarding shared chrome, then       │
    │  died at 66 lines with its secrets        │
    │  moved elsewhere.                         │
    │                                           │
    └───────────────────────────────────────────┘
```

```
    ┌───────────────────────────────────────────┐
    │                                           │
    │              R . I . P .                  │
    │                                           │
    │  Here lies `src/desktop/DesktopApp.tsx`.  │
    │  It lost most of its body mass and kept   │
    │  the native bridge alive long enough to   │
    │  deny involvement.                        │
    │                                           │
    └───────────────────────────────────────────┘
```

```
    ┌───────────────────────────────────────────┐
    │                                           │
    │              R . I . P .                  │
    │                                           │
    │  Here lies `src/shell/AppShell.tsx`.      │
    │  It absorbed the duplicated frame,        │
    │  hero, switcher, panels, and handles      │
    │  so the two shells could stop mirroring   │
    │  each other badly.                        │
    │                                           │
    └───────────────────────────────────────────┘
```

```
    ┌────────────────────────────────────────────┐
    │                                            │
    │              R . I . P .                   │
    │                                            │
    │  Here lies `src/shell/useWorkspaceResize`. │
    │  It inherited the geometry, the drag       │
    │  rituals, and the resize body-class        │
    │  fingerprints.                             │
    │                                            │
    └────────────────────────────────────────────┘
```

```
    ┌───────────────────────────────────────────┐
    │                                           │
    │              R . I . P .                  │
    │                                           │
    │  Here lie `webAdapter.tsx` and            │
    │  `desktopAdapter.tsx`. One kept browser   │
    │  habits contained, the other took         │
    │  custody of every native complication     │
    │  and called it architecture.              │
    │                                           │
    └───────────────────────────────────────────┘
```

```
    ┌───────────────────────────────────────────┐
    │                                           │
    │              R . I . P .                  │
    │                                           │
    │  Here lie the characterization tests.     │
    │  They arrived before the knife, which     │
    │  is why this funeral does not include     │
    │  a regression.                            │
    │                                           │
    └───────────────────────────────────────────┘
```

---

## ⚰️ Pallbearers

| Role | Name | Model | Dexter's Description |
|------|------|-------|---------------------|
| Planner | `planner` | gpt-5.5 | Verified the duplicated anatomy before anyone started cutting. |
| Plan Reviewer A | `plan-reviewer-a` | claude | Noticed the weak joints and declined to pretend they would hold. |
| Plan Reviewer B | `plan-reviewer-b` | gpt-5.5 | Made the desktop geometry problem impossible to ignore. |
| Arbiter | `arbiter` | claude | Pinned the ceilings and forced the harness decision into daylight. |
| Builder | `builder` | claude | Removed 4,473 lines of shell sprawl and left the hard ceilings intact. |
| Code Reviewer A | `code-reviewer-a` | claude | Came back for a second pass and made sure the typed contract actually meant something. |
| Code Reviewer B | `code-reviewer-b` | gpt-5.5 | Kept pressing until the escape hatches were either typed or confessed. |
| Fixer | `fixer` | gpt-5.5 | Cleaned the review wounds, documented the desktopAdapter debt, and left the patient stable enough to ship. |

---

## 💀 Coroner's Report

> A shared `AppShell`, a shared resize hook, two platform adapters, and first-commit characterization coverage shipped, while `src/App.tsx` fell from 1342 to 66 lines and `src/desktop/DesktopApp.tsx` from 3262 to 65. Cause of death was prolonged duplication, aggravated by two shells pretending not to be the same organism. Complications included a desktop geometry proof downgrade to computed-style equivalence under `jsdom` and an obese `desktopAdapter` that remains accepted debt rather than a solved problem. Even so, the hard ceilings cleared, PreviewPanel internals stayed untouched, and the validation gates came back green.

---

## 📜 Last Words

> _"Iteration 2 approved: shim re-export removed, AppShellProps typed for WorkingModeBar/DropZone, five desktop characterization scenarios covered, ceilings hold, PreviewPanel untouched."_
>
> — Code Reviewer A, iter 2 verdict

---

## ☠️ Cause of Death Rating

🥇 **GOLD** — _It shipped cleanly after one fix loop, but the desktop harness downgrade and the still-massive `desktopAdapter` keep it out of the more expensive caskets._

---

## 📊 Mortality Statistics

| Metric | Reading |
|--------|--------:|
| Plan iterations | 1 |
| Fix iterations | 1 |
| Hard ceilings cleared | 3 / 3 |
| Unit tests | 680 passing |
| E2E tests | 25 passing |
| Desktop characterization scenarios | 5 / 5 |
| PreviewPanel internals touched | 0 lines |
| Net source lines | -4,573 deleted, +4,852 added (test-first reshape) |
| `src/App.tsx` | 1342 → 66 (-95%) |
| `src/desktop/DesktopApp.tsx` | 3262 → 65 (-98%) |
| `desktopAdapter.tsx` | 2,437 lines (accepted debt) |
| Codex stream drops survived | 1 (retried once, completed) |

---

_Mood: darkly-amused. The patient was old, the duplication chronic, the prognosis grim, but the autopsy was clean._

— Dexter, coroner on duty (rendered by Jean-Claude)

_Content by Dexter. Rendered by Jean-Claude._
