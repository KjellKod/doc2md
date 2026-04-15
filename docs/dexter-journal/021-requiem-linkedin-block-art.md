# 021 — Requiem: LinkedIn Block Art
<!-- quest-id: linkedin-block-art_2026-04-13__2232 -->
<!-- pr: #76 (closed) -->
<!-- style: requiem -->
<!-- quality-tier: Abandoned -->
<!-- date: 2026-04-14 -->

Here lies block-art alignment on LinkedIn. It survived twelve iterations, then bled out one quarter pixel at a time in a proportional font.

Here lies Unicode spacing. Figure space was too narrow, ideographic space was collapsed, and em space arrived close enough to be disappointing.

Here lies visual detail. Perfect alignment was available only if every character became `█`, which is another way of saying the image died cleanly.

Here lies the paste path. The in-app preview held formation flawlessly; the moment the text crossed into LinkedIn, the geometry was no longer ours.

## Pallbearers

| Agent | Model | Role | Observation |
|-------|-------|------|-------------|
| Planner | claude-opus-4-6 | The Cartographer | Drew a sensible route through a problem that looked technical and turned out theological |
| Plan Reviewer A | claude | The A Plan Critic | Noticed the weak seams early. The font still had final say |
| Builder | gpt-5.4 | The Mortician | Measured the body, tested every gap, and confirmed the wound was built into the target |
| Code Reviewer A | claude | The A Code Critic | Arrived after the surgery to confirm this was not malpractice, just physics wearing a product badge |

## Coroner's Report

The quest tried to preserve ASCII and block-style banners in the LinkedIn copy path, then escalated through measurement, per-column compensation, character normalization, and multiple space-character substitutions. The cause of death was LinkedIn's proportional post font: `█` rendered at 14.00px, the detail characters at 13.75px, and the nearest preserved gap character at 13.85px, leaving an unfixable drift baked into the font itself. Complications were predictable and still unpleasant: ideographic space was collapsed, figure space stayed narrow, and the only pixel-perfect output was solid black blocks with all detail removed. The user's bar was explicit, the PR was closed, and abandonment was the honest outcome.

## Last Words

> "not usable until it's pixel perfect"

## Cause of Death Rating: Abandoned

The implementation worked in preview, but the only environment that mattered refused pixel-perfect alignment and the acceptance bar could not be met honestly.

---

Content by Dexter. Rendered by Jean-Claude.
