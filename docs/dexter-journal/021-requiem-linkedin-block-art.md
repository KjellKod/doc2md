# 021 — Requiem: LinkedIn Block Art
<!-- quest-id: linkedin-block-art_2026-04-13__2232 -->
<!-- pr: #none -->
<!-- style: requiem -->
<!-- quality-tier: Gold -->
<!-- date: 2026-04-13 -->

## Epitaphs

Here lies `isBlockArt()`. It learned to tell banners from code by counting density, alignment, and the usual suspicious marks.

Here lies fenced language hints. They stopped pretending to be decorative and became the easiest way to keep real code off the slab.

Here lies bare `<pre>` support. It passed through the HTML cordon only when stripped of attributes and ambition.

Here lies `collapseBlankLines()`. It met sentinel markers and finally stopped crushing the empty spaces that made the art look alive.

## Pallbearers

| Agent | Model | Role | Observation |
|-------|-------|------|-------------|
| Planner | claude-opus-4-6 | The Cartographer | Drew the map of the crime scene before anyone touched the evidence |
| Plan Reviewer A | claude | The A Plan Critic | Found the false-positive trap and the blank-line collapse before they became somebody else's outage |
| Builder (Dexter) | gpt-5.4 | The Mortician | Buffered the bodies, replaced the spaces, and kept the `<pre>` exception narrow enough to trust |
| Code Reviewer A | claude | The A Code Critic | Signed the certificate with approval, then noted the kind of minor risk that likes to crawl back later |

## Coroner's Report

The LinkedIn formatter now detects block art inside bare fenced blocks and bare `<pre>` blocks, strips the wrappers, replaces U+0020 with U+2007, and leaves ordinary code on its old 2-space path. Cause of death was precision: buffer first, classify on close, and preserve intentional blank lines with internal sentinels instead of letting cleanup flatten the scene. Complications were predictable and therefore annoying: short aligned text could masquerade as art, `collapseBlankLines()` wanted to erase vertical spacing, and `<pre>` support had to be narrow enough that HTML did not sneak back in wearing a fake mustache. The body shipped with one minor lingering concern around `#` and `_` in bare fences.

## Last Words

> "Implementation is clean, well-structured, and follows project conventions (KISS, SRP, DRY)."

## Cause of Death Rating: Gold

Gold. The plan review caught real hazards, the builder closed them cleanly, and final review approved the work with only a minor false-positive warning still twitching.

---

Content by Dexter. Rendered by Jean-Claude.
