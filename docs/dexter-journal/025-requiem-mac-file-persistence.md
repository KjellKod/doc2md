# 025 — Requiem: Mac File Persistence
<!-- quest-id: mac-file-persistence_2026-04-22__2017 -->
<!-- pr: none yet -->
<!-- style: requiem -->
<!-- quality-tier: Gold -->
<!-- date: 2026-04-22 -->

<pre>
        ╔═══════════════════════╗
        ║    R  .  I  .  P  .   ║
        ╚═══════════════════════╝

███╗   ███╗ █████╗  ██████╗
████╗ ████║██╔══██╗██╔════╝
██╔████╔██║███████║██║
██║╚██╔╝██║██╔══██║██║
██║ ╚═╝ ██║██║  ██║╚██████╗
╚═╝     ╚═╝╚═╝  ╚═╝ ╚═════╝

███████╗██╗██╗     ███████╗
██╔════╝██║██║     ██╔════╝
█████╗  ██║██║     █████╗
██╔══╝  ██║██║     ██╔══╝
██║     ██║███████╗███████╗
╚═╝     ╚═╝╚══════╝╚══════╝

██████╗ ███████╗██████╗ ███████╗
██╔══██╗██╔════╝██╔══██╗██╔════╝
██████╔╝█████╗  ██████╔╝███████╗
██╔═══╝ ██╔══╝  ██╔══██╗╚════██║
██║     ███████╗██║  ██║███████║
╚═╝     ╚══════╝╚═╝  ╚═╝╚══════╝
</pre>

🪦 ⚰️ 🕯️  *mac-file-persistence_2026-04-22__2017*  🕯️ ⚰️ 🪦

---

## 🪦 Epitaphs

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│  Here lies the Phase 2 bridge stub.                      │
│  It promised files and delivered theater.                │
│                                                          │
│  Replaced by FileStore: open, save, save-as, reveal,     │
│  conflict detection, and typed error paths.              │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│  Here lies silent failure.                               │
│  It died in a status region with witnesses.              │
│                                                          │
│  Conflicts, permissions, cancelled panels, and plain      │
│  errors now surface in the desktop shell.                │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│  Here lies "load succeeded" as proof.                    │
│  It fired before React could fall over.                  │
│                                                          │
│  The smoke now waits for rendered toolbar UI and logs     │
│  app ready: true.                                        │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

## ⚰️ Pallbearers

| Agent | Runtime | Role | Last Known Condition |
|---|---|---|---|
| planner | Codex | planner | Took three passes, then learned to demand native tests. |
| plan-reviewer-a | Codex | plan-reviewer-a | Kept the plan from confusing hope with validation. |
| plan-reviewer-b | Codex | plan-reviewer-b | Agreed independently, which is suspicious but useful. |
| arbiter | Codex | arbiter | Approved only after `doc2mdTests` stopped being decorative. |
| builder | Codex | builder | Replaced bridge stubs with real filesystem behavior. |
| code-reviewer-a | Codex | code-reviewer-a | Found the panel filter leak and came back clean after fix two. |
| code-reviewer-b | Codex | code-reviewer-b | Confirmed the panel filter leak was dead. |
| fixer | Codex | fixer | Switched panels to exact extension filtering and accepted the deprecation warning as evidence. |

---

## 💀 Coroner's Report

> Phase 3 shipped real Markdown file persistence for the Mac shell: open, save, save-as, reveal, conflict detection, permission mapping, line-ending preservation, atomic writes, and visible error UX. Cause of death: feature complete. Complications included three plan iterations, two fix iterations, one subtle UTType widening trap, and a stale running app process that had to be stopped with user approval before smoke could testify.

---

## 📜 Last Words

> *"Fix iteration 2 resolves the panel filtering issue with no new blockers found."*
>
> — Code Reviewer B, final verdict

---

## ☠️ Cause of Death Rating: 🥇 GOLD 🥇

The quest took real pressure from planning and review, then landed clean: 331 Vitest tests, 7 native FileStore tests, Debug and Release `xcodebuild`, and rendered launch smoke all passed. Not flawless. Not fragile. Shipped.

---

🕯️ *The body had files in its hands and mtime under its fingernails. Finally, evidence.* 🕯️

— Dexter, coroner on duty

