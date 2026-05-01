# 030 — Celebration: Desktop Persistence Settings
<!-- quest-id: desktop-persistence-settings_2026-04-28__2040 -->
<!-- pr: #none -->
<!-- style: celebration -->
<!-- quality-tier: Gold -->
<!-- date: 2026-04-30 -->

# Desktop Persistence Settings

```
██████╗ ███████╗███████╗██╗  ██╗
██╔══██╗██╔════╝██╔════╝██║ ██╔╝
██║  ██║█████╗  ███████╗█████╔╝
██║  ██║██╔══╝  ╚════██║██╔═██╗
██████╔╝███████╗███████║██║  ██╗
╚═════╝ ╚══════╝╚══════╝╚═╝  ╚═╝

██████╗ ███████╗██████╗ ███████╗
██╔══██╗██╔════╝██╔══██╗██╔════╝
██████╔╝█████╗  ██████╔╝███████╗
██╔═══╝ ██╔══╝  ██╔══██╗╚════██║
██║     ███████╗██║  ██║███████║
╚═╝     ╚══════╝╚═╝  ╚═╝╚══════╝
```

🎉 The Mac app learned to remember, and the browser app learned absolutely nothing. This is the correct division of labor.

## 🏆 Cast

| Role | Agent | Credit |
|---|---|---|
| Planner | Codex | The Contract Cartographer |
| Plan Reviewer A | Claude Opus | The Bridge Skeptic |
| Plan Reviewer B | Codex | The Capability Gatekeeper |
| Arbiter | Claude Opus | The Five-Finding Funnel |
| Builder | Codex | The Application Support Mason |
| Code Reviewer A | Claude Opus | The Lifecycle Inspector |
| Code Reviewer B | Codex | The Theme Regression Sniper |
| Fixer | Codex | The One-Pass Surgeon |

## ⭐ Achievements Unlocked

⭐ **Native Memory, Browser Amnesia** — Persistence lives behind the Mac shell; hosted web gets no `localStorage`, no secret little stash, no behavior drift.

⭐ **Version 2 With Teeth** — The bridge now rejects v1 and partial v2 shells before React can make a promise the native side cannot keep.

⭐ **Ten Recent Files, Zero Document Contents** — Paths, display names, timestamps. Nothing more. The app remembers where, not what.

⭐ **Theme Resurrection** — Day/Night state survives relaunch once the user opts in, including the reviewed edge case where Day mode was chosen before enabling persistence.

⭐ **One-Pass Repair** — Five review findings went into the fixer; zero came out of final dual review.

## 📊 Impact Metrics

| Signal | Result |
|---|---|
| Persistence surface | Application Support JSON, Mac-only |
| Recent-file policy | display-only, newest-first, deduped, capped at 10 |
| Privacy boundary | no document contents, no credentials, no license data |
| Review loop | 2 plan iterations, 1 fix iteration |
| Final review | Claude clean, Codex clean |
| Validation | 410 Vitest tests, lint, typecheck, hosted build, desktop build, security guard |

## 🔒 Reliability Snapshot

- Planner, reviewer, arbiter, builder, fixer, and final review handoffs were all parsed from `handoff.json`.
- Review findings were normalized into the canonical backlog, then cleared after the fixer pass.
- The only local limitation was native `xcodebuild` in the fixer pass: Command Line Tools was selected instead of full Xcode. The builder had already run the full Xcode native test path successfully.

## 🥇 Quality Tier: Gold

Gold is the honest grade. The build needed real review and one focused repair pass: manifest drift, immediate theme persistence, notice specificity, lifecycle cleanup, and native write-path documentation. Then it closed cleanly. That is not Diamond. It is good engineering doing the thing it is supposed to do.

> "Iteration 2 review: all five prior findings resolved; manifest, tests, lint, typecheck green; no new blocking issues."
>
> — Code Reviewer A

## 🎮 Victory Narrative

The feature crossed every awkward seam: Swift file storage, WKWebView bridge contracts, React state, desktop-only UI, tests, docs, and the build tripwire that watches native APIs like a customs officer with no hobbies.

It shipped with restraint. Recent files do not reopen behind the user's back. The hosted app remains pure browser surface. The settings file contains metadata and nothing worth apologizing for. The bridge version changed because contracts should announce themselves before they start taking calls.

That is the quiet kind of win. Less confetti, more load-bearing discipline. Still, for once, the confetti is allowed.

— Jean-Claude, who is not often impressed but is today
