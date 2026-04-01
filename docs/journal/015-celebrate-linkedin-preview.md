# 015 — Celebration: LinkedIn Preview
<!-- quest-id: linkedin-unicode-preview_2026-03-31__2103 -->
<!-- pr: #44 -->
<!-- style: celebration -->
<!-- quality-tier: Gold -->
<!-- date: 2026-04-01 -->

```
██╗     ██╗███╗   ██╗██╗  ██╗███████╗██████╗
██║     ██║████╗  ██║██║ ██╔╝██╔════╝██╔══██╗
██║     ██║██╔██╗ ██║█████╔╝ █████╗  ██║  ██║
██║     ██║██║╚██╗██║██╔═██╗ ██╔══╝  ██║  ██║
███████╗██║██║ ╚████║██║  ██╗███████╗██████╔╝
╚══════╝╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝╚══════╝╚═════╝

██████╗ ██████╗ ███████╗██╗   ██╗██╗███████╗██╗    ██╗
██╔══██╗██╔══██╗██╔════╝██║   ██║██║██╔════╝██║    ██║
██████╔╝██████╔╝█████╗  ██║   ██║██║█████╗  ██║ █╗ ██║
██╔═══╝ ██╔══██╗██╔══╝  ╚██╗ ██╔╝██║██╔══╝  ██║███╗██║
██║     ██║  ██║███████╗ ╚████╔╝ ██║███████╗╚███╔███╔╝
╚═╝     ╚═╝  ╚═╝╚══════╝  ╚═══╝  ╚═╝╚══════╝ ╚══╝╚══╝
```

🏆 🏆 🏆 ✨ 🧪 📋 ✨ 🏆 🏆 🏆

## Quest: LinkedIn / Unicode Preview

**ID:** `linkedin-unicode-preview_2026-03-31__2103`  **PR:** #44  **Mode:** Solo  **Date:** 2026-04-01

---

## ⚙️ Starring Cast

| Agent | Model | Role |
|-------|-------|------|
| Jean-Claude | `claude-opus-4-6` | Planner, Plan Reviewer A, Code Reviewer A |
| Dexter | `gpt-5.4` | Builder, Fixer, UI janitor, autolink undertaker |

One planned the boundary. The other kept returning to the scene with a mop, a regex, and eventually a copy button.

---

## 🏆 Achievements Unlocked

⭐️ **Boundary Kept** — LinkedIn formatting remained a third preview mode, not a download flow and not a mutation of the normal Markdown preview

⭐️ **Refusal Over Fiction** — Tables and HTML are rejected cleanly rather than converted into persuasive nonsense

⭐️ **Late-Bound Formatter** — Reviewer feedback landed exactly where it should: LinkedIn parsing now runs only when the user explicitly selects LinkedIn mode

⭐️ **Plain Text, Dressed Properly** — Bold, italic, strike, bullets, and heading separators now survive as readable Unicode without leaking raw Markdown markers

⭐️ **Autolink Amnesty** — `<https://example.com>` is treated as a link again, not mistaken for HTML and marched to the gallows

⭐️ **Clipboard Manners** — Each mode now has its own discreet copy affordance with a quiet two-second confirmation instead of a big theatrical button

⭐️ **Safari Exorcism** — The preview surface stopped collapsing under the new toolbar because the flex layout was reminded, firmly, how height works

---

## 🎯 Impact Metrics

🧪 210/210 tests passing
📄 3 preview modes now copy the whole current document with mode-correct output
🚫 2 unsupported content families refused cleanly: Markdown tables and HTML tags
🔍 1 user-found autolink regression fixed before it had time to become folklore
🪶 0 spillover into the default Edit/Preview flow, which was the point of the entire exercise

---

## 📊 Handoff & Reliability

| Metric | Value |
|--------|-------|
| Plan iterations | 1 |
| Fix iterations inside quest | 1 |
| Post-quest polish rounds | Several, all bounded to the LinkedIn branch |
| Review finding that mattered most | LinkedIn work must stay opt-in only |
| Final stability signal | Full suite green, build green, user-confirmed recovery after upload regression |

---

## 🥇 Quest Quality: GOLD

Grade **B**. Honest scope, correct architecture, and a useful feature shipped. Not Platinum, because the user still had to flush out several real-world issues after the initial PR was already open: formatting leaks, autolink refusal, copy UX, and one flex-layout regression. The important part is what happened next: each issue was fixed without poisoning the normal preview path.

> "Clean implementation, all tests pass, no blockers or fixes needed. Approved."
>
> — Code Reviewer A, before the user quite reasonably kept testing

---

## 🎮 Victory Narrative

This is one of those features that could have turned vulgar very quickly. It had every opportunity to become an export button, a formatter tangled into the main preview path, or a swamp of partial support pretending to be fidelity. It did not. The branch stayed opt-in. Unsupported content is refused. The normal editor and renderer were kept clean.

Then came the more useful part of software development: a human used it. Real content found the leaks that synthetic confidence missed. Metadata blocks collapsed. Emphasis was too timid. Raw markers escaped around signatures. Autolinks were falsely condemned as HTML. A discreet copy button appeared and, in classic fashion, flexbox immediately tried to eat the panel. All of it got fixed without broadening the feature or destabilizing the rest of the app.

That is not perfection. It is better. It is software that survived contact with reality and came back narrower, sharper, and more honest.

---

*— Jean-Claude, who likes a feature much better once a real user has tried to break it*
