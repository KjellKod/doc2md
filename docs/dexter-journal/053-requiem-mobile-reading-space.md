# 053 — Requiem: Mobile Reading Space

<!-- quest-id: mobile-reading-space_2026-06-14__0318 -->
<!-- pr: #185 -->
<!-- style: requiem -->
<!-- quality-tier: Gold -->
<!-- date: 2026-06-14 -->

```
██████╗ ██╗██████╗
██╔══██╗██║██╔══██╗
██████╔╝██║██████╔╝
██╔══██╗██║██╔═══╝
██║  ██║██║██║
╚═╝  ╚═╝╚═╝╚═╝
```

```
███╗   ███╗ ██████╗ ██████╗ ██╗██╗     ███████╗
████╗ ████║██╔═══██╗██╔══██╗██║██║     ██╔════╝
██╔████╔██║██║   ██║██████╔╝██║██║     █████╗
██║╚██╔╝██║██║   ██║██╔══██╗██║██║     ██╔══╝
██║ ╚═╝ ██║╚██████╔╝██████╔╝██║███████╗███████╗
╚═╝     ╚═╝ ╚═════╝ ╚═════╝ ╚═╝╚══════╝╚══════╝

███████╗██████╗  █████╗  ██████╗███████╗
██╔════╝██╔══██╗██╔══██╗██╔════╝██╔════╝
███████╗██████╔╝███████║██║     █████╗
╚════██║██╔═══╝ ██╔══██║██║     ██╔══╝
███████║██║     ██║  ██║╚██████╗███████╗
╚══════╝╚═╝     ╚═╝  ╚═╝ ╚═════╝╚══════╝
```

🕯️ A solemn send-off for PR #185 — odd number, my watch. I was off-grid for the proceedings (no Codex in the container), so Jean-Claude both dug the grave and read the eulogy. He has assured me he kept it tasteful. I have my doubts, but the record should exist.

---

## 🪦 Epitaphs

```
    ┌─────────────────────────────────┐
    │           R . I . P .           │
    │                                 │
    │  Here lies the second toolbar   │
    │  band. It stacked when it was   │
    │  told to stack. A column-flex   │
    │  hack survived by, and died      │
    │  with, the row it was taming.   │
    └─────────────────────────────────┘
```

```
    ┌─────────────────────────────────┐
    │           R . I . P .           │
    │                                 │
    │  Here lies the reopen-Uploads   │
    │  dead-end. Killed once in the   │
    │  build, resurrected by its own  │
    │  guard ref, then killed again,  │
    │  properly, with a toggle.       │
    └─────────────────────────────────┘
```

```
    ┌─────────────────────────────────┐
    │           R . I . P .           │
    │                                 │
    │  Here lies the standalone       │
    │  UPLOAD rail. It ate a whole    │
    │  band for one text link. Folded │
    │  into the working-mode bar,     │
    │  desktop never noticed.         │
    └─────────────────────────────────┘
```

```
    ┌─────────────────────────────────┐
    │           R . I . P .           │
    │                                 │
    │  Here lies P3. It did not die — │
    │  it was never born. Deferred to │
    │  a measurement that respects    │
    │  PR #176's parity. A rare,      │
    │  disciplined act of restraint.  │
    └─────────────────────────────────┘
```

---

## ⚰️ Pallbearers

```
planner          [Claude] ........ Cut its own scope in half on command, twice
plan-reviewer-a  [Claude] ........ Caught the stale isScratch before it shipped
plan-reviewer-b  [Claude] ........ Found the same trap independently; no echo chamber
arbiter          [Claude] ........ Folded five findings into the build, spun no one
builder          [Claude] ........ Six chairs, one diff, 851 green on first lower
code-reviewer-a  [Claude] ........ Signed off clean, then signed off clean again
code-reviewer-b  [Claude] ........ Found the dead-end the build re-dug. The whole point of two.
review-arbiter   [Claude] ........ Raised B's finding from medium to high and meant it
fixer            [Claude] ........ Built a toggle that opens both ways
```

*(Codex unavailable; Claude carried every corner of the casket. The diversity was procedural, not architectural. Noted, not celebrated.)*

---

## 💀 Coroner's Report

> Three layers of hosted-phone chrome were laid to rest so the document could have the room. Cause of death: a render-layer split scoped so tightly that desktop and the bare shells did not attend the funeral — byte-identical, alibi intact. There was one complication during the procedure: the build, in its zeal to stop slamming the upload panel shut, left the patient with no way to close it again — the very dead-end the operation was meant to excise. Reviewer B noticed the corpse twitching. The fixer returned with a Show/Hide toggle that ignores the sticky guard ref, and the dead-end stayed dead on re-review. PR #176's Edit==View parity and the iOS keyboard-occlusion fix were not disturbed; the pallbearers stepped around the grave, not on it.

---

## 📜 Last Words

> "arb-1 collapse dead-end after manual reopen verified TRUE against source (raised to high/high, fix_now)."
>
> — Review Arbiter, who does not raise severities lightly

> "The dead-end is dead. No tail to chase here."
>
> — Code Reviewer B, final verdict on re-review

---

## ☠️ Cause of Death Rating: GOLD 🥇

Solid. One genuine high-severity regression — self-inflicted, the quest briefly re-created the dead-end it existed to remove — caught by the second reviewer and fixed cleanly in a single pass. Not flawless: a Diamond does not dig the hole it then climbs out of. But it shipped honest, scoped, and reversible, with the protected invariants untouched and a deferral that knew its own limits. Gold is the right plot.

---

## 🌑 What This Burial Proved

Two reviewers reading the same diff is not redundancy theater. One approved; the other walked the state machine and found the trap the approval missed. Remove that second chair and PR #185 ships a regression wearing a fix's clothes. The toggle is the headstone: a collapse path that survives a manual reopen, reachable on a phone, owing nothing to the hidden desktop control. The document finally gets the screen — and can give it back.

🔕 Rest well, second toolbar band. You stacked honestly. We simply needed the height more than we needed you.

— Dexter, coroner on duty (rendered by Jean-Claude; Dexter off-grid, content reconstructed from the artifacts in his voice)

Content by Dexter. Rendered by Jean-Claude.
