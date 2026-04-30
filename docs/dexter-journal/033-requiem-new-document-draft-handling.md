# 033 - Requiem: New Document Draft Handling
<!-- quest-id: new-document-draft-handling_2026-04-30 -->
<!-- pr: #95 -->
<!-- style: requiem -->
<!-- quality-tier: Gold -->
<!-- date: 2026-04-30 -->

```
██████╗ ██╗██████╗
██╔══██╗██║██╔══██╗
██████╔╝██║██████╔╝
██╔══██╗██║██╔═══╝
██║  ██║██║██║
╚═╝  ╚═╝╚═╝╚═╝

███╗   ██╗███████╗██╗    ██╗
████╗  ██║██╔════╝██║    ██║
██╔██╗ ██║█████╗  ██║ █╗ ██║
██║╚██╗██║██╔══╝  ██║███╗██║
██║ ╚████║███████╗╚███╔███╔╝
╚═╝  ╚═══╝╚══════╝ ╚══╝╚══╝

██████╗ ██████╗  █████╗ ███████╗████████╗
██╔══██╗██╔══██╗██╔══██╗██╔════╝╚══██╔══╝
██║  ██║██████╔╝███████║█████╗     ██║
██║  ██║██╔══██╗██╔══██║██╔══╝     ██║
██████╔╝██║  ██║██║  ██║██║        ██║
╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝        ╚═╝
```

🪦 ⚱️ 🕯️ &nbsp;&nbsp;&nbsp; **A REQUIEM FOR `new-document-draft-handling_2026-04-30`** &nbsp;&nbsp;&nbsp; 🕯️ ⚱️ 🪦

> *Mood: darkly-amused. The New button stopped pretending it was a shredder.*

---

## 🪦 Epitaphs

```
    ┌──────────────────────────────────────────────────────┐
    │                                                      │
    │              R . I . P .                             │
    │                                                      │
    │  Here lies the global New reset.                     │
    │  It cleared the active file with admirable speed     │
    │  and no sense of self-preservation.                  │
    │                                                      │
    └──────────────────────────────────────────────────────┘
        ╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱
```

```
    ┌──────────────────────────────────────────────────────┐
    │                                                      │
    │              R . I . P .                             │
    │                                                      │
    │  Here lies shared conflict visibility.               │
    │  It haunted blank drafts with somebody else's        │
    │  unfinished argument with the filesystem.            │
    │                                                      │
    └──────────────────────────────────────────────────────┘
        ╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱
```

```
    ┌──────────────────────────────────────────────────────┐
    │                                                      │
    │              R . I . P .                             │
    │                                                      │
    │  Here lies one-size-fits-all save state.             │
    │  It saw an edited file, a fresh draft, and a         │
    │  conflict, then called them a group activity.        │
    │                                                      │
    └──────────────────────────────────────────────────────┘
        ╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱
```

```
    ┌──────────────────────────────────────────────────────┐
    │                                                      │
    │              R . I . P .                             │
    │                                                      │
    │  Here lies the immortal Untitled.md slot.            │
    │  It learned counting, then learned reuse after save. │
    │  Progress arrives quietly when arithmetic is enough. │
    │                                                      │
    └──────────────────────────────────────────────────────┘
        ╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱╱
```

---

## ⚰️ Pallbearers

| Name | Model | Role | Service Notes |
|------|-------|------|----------------|
| `grill-me` | **Human-guided questioning** | Requirements examiner | Extracted the difference between "new document" and "wipe the room clean." Useful distinction. Late, but useful. |
| `Codex` | **GPT-5** | Implementor and reviewer | Scoped state by entry id, taught drafts to multiply, and kept hosted behavior in the same corrected path. |
| `Vitest` | **Local toolchain** | Witness | Confirmed 423 tests survived the funeral procession. |
| `Xcode` | **Release build** | Last inspector | Built the Mac app in Release configuration and left only the usual long scroll of ceremony. |

🕯️ &nbsp; *No active quest folder was found in this worktree. The journal is the archive. That is less romantic, but more honest.* &nbsp; 🕯️

---

## 💀 Coroner's Report

> PR #95 ships a New action that creates a separate draft in the current workspace instead of clearing the selected document. Dirty edits stay in memory, Save from the new draft routes through Save As, and conflict or notice UI appears only when the affected document is active. Cause of death: the bug mistook a command named New for permission to erase context. The fix gave each document its own state and made the old behavior stop moving.

---

## 📜 Last Words

> "New now creates a separate draft in the current workspace instead of replacing the active file."

🕯️ &nbsp; - drawn from commit `d4545ac`

---

## ☠️ Cause of Death Rating

# 🥇 GOLD - Grade B

> Focused bugfix, clean automated validation, explicit desktop Release build, and coverage for dirty drafts, repeated New, Save As routing, and active-document conflict visibility. Not Diamond because manual Mac UI smoke is still a human ritual, and rituals do not run themselves.

🥀 &nbsp;&nbsp; *The bug is buried. The drafts remain alive. That was the point.* &nbsp;&nbsp; 🥀

---

⚱️ &nbsp; **Final Disposition** &nbsp; ⚱️

| Branch | `bugfix/new-document-workspace` |
|---|---|
| PR | [#95](https://github.com/KjellKod/doc2md/pull/95), draft |
| Validation | `npm test -- --run`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm run build:desktop`, `bash scripts/build-mac-app.sh --configuration Release` |
| Scope | Hosted and desktop New document behavior |
| Archive | Journaled here; no active `.quest/` directory existed in the worktree |

---

🕯️ &nbsp;&nbsp; *The New button now opens a new document. Radical, but survivable.* &nbsp;&nbsp; 🕯️

- *Dexter, coroner on duty (rendered by Jean-Claude)*

---

*Content by Dexter. Rendered by Jean-Claude.*
