# 004 — Requiem: PDF Formatting Intelligence
<!-- quest-id: pdf-formatting-intelligence (direct implementation) -->
<!-- pr: #23 -->
<!-- style: requiem -->
<!-- quality-tier: Platinum -->
<!-- date: 2026-03-28 -->

```
██████╗  ██╗██████╗
██╔══██╗ ██║██╔══██╗
██████╔╝ ██║██████╔╝
██╔══██╗ ██║██╔═══╝
██║  ██║ ██║██║
╚═╝  ╚═╝ ╚═╝╚═╝
```

## 🪦 Epitaphs

Here lies the flat-text PDF wall. It mistook extraction for formatting and died when structure finally showed up with paperwork.

Here lies the font profile. It stopped judging a page one shrug at a time and started taking testimony from the whole document.

Here lies heading detection. It learned that larger type usually means the author wanted to be heard.

Here lies bold detection. It read the font names, found the swagger, and marked it accordingly.

Here lies bullet detection. It now respects actual bullet characters and no longer deputizes every dash in town.

Here lies paragraph recovery. It watched the Y-position gaps and put breathing room back where prose had been flattened.

## ⚰️ Pallbearers

| Bearer | Model | Role | Assessment |
|--------|-------|------|------------|
| Jean-Claude | claude-opus-4-6 | Builder + PR Shepherd | Did the surgery solo and still had the sense to let review interrupt his optimism. |
| Codex CI | codex | Automated Code Reviewer | Showed up as the coroner before the burial and found the two cuts that actually mattered. |

## 💀 Coroner's Report

PR #23 shipped formatting intelligence for the PDF converter: headings from font size, bold from font names, bullets from bullet characters, and paragraph breaks from Y-position gaps, with the font profile computed across all pages instead of guessed in fragments. This was direct implementation through pr-shepherd rather than the formal quest pipeline, which is cause-of-death paperwork, not a moral crisis. Complications were minor and instructive: font size extraction needed `Math.hypot` to survive rotation, and the bullet matcher had to stop treating ordinary dashes like enlisted list markers. The patient expired cleanly with 76 passing tests and a clean build.

## 📜 Last Words

> "Font size extraction needed Math.hypot for rotation safety, and bullet pattern was too aggressive with dashes."

## ☠️ Cause of Death Rating: PLATINUM 🏆

Two legitimate review findings surfaced, both were fixed cleanly, and the feature shipped without a fix-loop melodrama.

---

— Dexter, coroner on duty (rendered by Jean-Claude)

Content by Dexter. Rendered by Jean-Claude.
