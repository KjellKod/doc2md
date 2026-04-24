# 026 — Requiem: Mac Phase 4 — Converted Document Import and Markdown Persistence
<!-- quest-id: phase-4-converted-docs-persistent-assets_2026-04-23__2328 -->
<!-- pr: #81 -->
<!-- style: requiem -->
<!-- quality-tier: Gold -->
<!-- date: 2026-04-23 -->

<pre>
██████╗  ██╗ ██████╗ 
██╔══██╗ ██║ ██╔══██╗
██████╔╝ ██║ ██████╔╝
██╔══██╗ ██║ ██╔═══╝ 
██║  ██║ ██║ ██║     
╚═╝  ╚═╝ ╚═╝ ╚═╝     

██████╗ ██╗  ██╗ █████╗ ███████╗███████╗
██╔══██╗██║  ██║██╔══██╗██╔════╝██╔════╝
██████╔╝███████║███████║███████╗█████╗  
██╔═══╝ ██╔══██║██╔══██║╚════██║██╔══╝  
██║     ██║  ██║██║  ██║███████║███████╗
╚═╝     ╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝╚══════╝

███████╗ ██████╗ ██╗   ██╗██████╗ 
██╔════╝██╔═══██╗██║   ██║██╔══██╗
█████╗  ██║   ██║██║   ██║██████╔╝
██╔══╝  ██║   ██║██║   ██║██╔══██╗
██║     ╚██████╔╝╚██████╔╝██║  ██║
╚═╝      ╚═════╝  ╚═════╝ ╚═╝  ╚═╝
</pre>

🦇 🕯️ ⚰️ 🪦 🖤 🕯️ 🦇

## 🪦 Epitaphs

```
    ┌───────────────────────────────────────────┐
    │                                           │
    │            R . I . P .                    │
    │                                           │
    │   Here lies `doc2mdShell.d.ts`.           │
    │   It stopped treating imported files as   │
    │   counterfeit markdown and tagged the     │
    │   dead correctly.                         │
    │                                           │
    └───────────────────────────────────────────┘
        ╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱
```

```
    ┌───────────────────────────────────────────┐
    │                                           │
    │            R . I . P .                    │
    │                                           │
    │   Here lies the oversized bridge          │
    │   payload.                                │
    │                                           │
    │   It was denied the base64 procession     │
    │   and replaced with an opaque `doc2md://` │
    │   handoff that kept binary bytes off the  │
    │   main road.                              │
    │                                           │
    └───────────────────────────────────────────┘
        ╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱
```

```
    ┌───────────────────────────────────────────┐
    │                                           │
    │            R . I . P .                    │
    │                                           │
    │   Here lies the source-file overwrite     │
    │   path.                                   │
    │                                           │
    │   Three save barriers and a Swift-side    │
    │   `.md` veto put it down before           │
    │   somebody's `.pdf` became an accident    │
    │   report.                                 │
    │                                           │
    └───────────────────────────────────────────┘
        ╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱
```

```
    ┌───────────────────────────────────────────┐
    │                                           │
    │            R . I . P .                    │
    │                                           │
    │   Here lies the second extension list.    │
    │                                           │
    │   A generator chained Swift to            │
    │   `SUPPORTED_FORMATS` so drift would      │
    │   have to fail the build in public.       │
    │                                           │
    └───────────────────────────────────────────┘
        ╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱
```

```
    ┌───────────────────────────────────────────┐
    │                                           │
    │            R . I . P .                    │
    │                                           │
    │   Here lies `Cmd+S` during conversion.    │
    │                                           │
    │   It no longer gets to write an empty     │
    │   `.md` while the import is still         │
    │   deciding whether to live.               │
    │                                           │
    └───────────────────────────────────────────┘
        ╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱
```

```
    ┌───────────────────────────────────────────┐
    │                                           │
    │            R . I . P .                    │
    │                                           │
    │   Here lies the generic oversized-        │
    │   import notice.                          │
    │                                           │
    │   It stopped calling every corpse         │
    │   "Import failed" and finally named       │
    │   the `128 MB` limit.                     │
    │                                           │
    └───────────────────────────────────────────┘
        ╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱
```

---

## ⚰️ Pallbearers

| Mourner | Model | Role | Dexter's note |
|---|---|---|---|
| 🫡 **Jean-Claude** | `claude-opus-4-7 (1M context)` | Planner · Plan Reviewer A · Arbiter · Code Reviewer A · Orchestrator | *Measured every cheerful claim against the file and line until it either held or confessed.* |
| 🫡 **Dexter** | `gpt-5 (codex)` | Plan Reviewer B · Builder · Code Reviewer B · Fixer | *Built the handoff, traced the weak seams, and came back for the one error message still trying to die anonymously.* |

---

## 💀 Coroner's Report

> Phase 4 shipped the Mac import-to-Markdown lifecycle: supported non-`.md` documents now enter through the existing web converter path, first save becomes `Save As`, later saves update the chosen `.md`, source files remain untouched, and embedded assets are dropped on purpose.
>
> Cause of death was optimism near disk access; the new shell contract, opaque handoff route, `.md`-only persistence, and drift check killed the old fiction that every format should behave like markdown.
>
> Complications were real but survivable: the plan needed a second pass for five deltas, the fix loop needed a second cut when the 413 body text was still buried under a generic notice, and both reviewers kept finding different seams where a quiet regression could have walked in.
>
> The remains were declared stable after 343 Vitests, typecheck, lint, `xcodebuild` in Debug and Release, the release-launch smoke, and the format-generator check all came back green.

---

## 📜 Last Words

> *"F7 clean: 413 body text surfaces, non-413 non-OK stays generic, Vitest locks exact body text."*
>
> — Code Reviewer A, final verdict 🕯️

---

## ☠️ Cause of Death Rating

<pre>
        🪦  𝐆 𝐎 𝐋 𝐃  🪦

    Two plan passes and a follow-up fix
    kept it out of Platinum, but the
    dangerous parts were caught in review
    instead of production, and the final
    validation matrix came back clean.
</pre>

**Mood:** *darkly-amused* 🦇

---

*— Dexter, coroner on duty (rendered by Jean-Claude)*

*Content by Dexter. Rendered by Jean-Claude.*
