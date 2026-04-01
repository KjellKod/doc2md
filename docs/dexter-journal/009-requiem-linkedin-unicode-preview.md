# 009 — Requiem: LinkedIn Unicode Preview
<!-- quest-id: linkedin-unicode-preview_2026-03-31__2103 -->
<!-- pr: none -->
<!-- style: requiem -->
<!-- quality-tier: Platinum -->
<!-- date: 2026-03-31 -->
<pre>
██████╗ ██╗██████╗
██╔══██╗██║██╔══██╗
██████╔╝██║██████╔╝
██╔══██╗██║██╔═══╝
██║  ██║██║██║
╚═╝  ╚═╝╚═╝╚═╝

██╗     ██╗███╗   ██╗██╗  ██╗
██║     ██║████╗  ██║██║ ██╔╝
██║     ██║██╔██╗ ██║█████╔╝
██║     ██║██║╚██╗██║██╔═██╗
███████╗██║██║ ╚████║██║  ██╗
╚══════╝╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝

██╗   ██╗███╗   ██╗██╗ ██████╗ ██████╗ ██████╗ ███████╗
██║   ██║████╗  ██║██║██╔════╝██╔═══██╗██╔══██╗██╔════╝
██║   ██║██╔██╗ ██║██║██║     ██║   ██║██║  ██║█████╗
██║   ██║██║╚██╗██║██║██║     ██║   ██║██║  ██║██╔══╝
╚██████╔╝██║ ╚████║██║╚██████╗╚██████╔╝██████╔╝███████╗
 ╚═════╝ ╚═╝  ╚═══╝╚═╝ ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝
</pre>

## Quest: LinkedIn Unicode Preview

**ID:** `linkedin-unicode-preview_2026-03-31__2103`  **PR:** none  **Mode:** Solo  **Date:** 2026-03-31

---

## Epitaphs

Here lies the assumption that LinkedIn formatting should leak into the normal preview path. It survived until review, then was put down cleanly. The special mode now wakes only when summoned.

Here lies the temptation to fake support for tables and HTML. It was offered the usual shallow compromise, then refused burial rights. Unsupported content gets a refusal message, not a pretty lie.

Here lies the idea that this needed a downloader, exporter, or side quest into product sprawl. It died early. One new mode, one bounded formatter, one narrow surface. The body count stayed manageable.

---

## Pallbearers

`planner [claude-opus-4-6] ........ Boundary Undertaker`
`plan-reviewer-a [claude-opus-4-6] ........ First Knife`
`builder [gpt-5.4] ........ Toggle Surgeon`
`code-reviewer-a [claude-opus-4-6] ........ Performance Coroner`
`fixer [gpt-5.4] ........ Late-Stage Anesthetist`

---

## Coroner's Report

Cause of death was ambiguity. The product wanted a LinkedIn-flavored Unicode view, but the dangerous version of that feature would have entangled itself with the normal edit and preview path until every routine render paid for an optional branch. The review caught it before rigor mortis set in.

What shipped is smaller and healthier: an opt-in LinkedIn mode, conservative refusal for tables and HTML, deterministic plain-text formatting for the supported subset, and a direct guard that keeps the formatter dormant unless the user explicitly chooses that view.

---

## Proceedings

| Metric | Value |
|--------|-------|
| Plan iterations | 1 |
| Fix iterations | 1 |
| Review rounds | 2 |
| Default-path damage | none |
| Full suite | 202 passing |
| Reliability signal | 5/5 handoff entries arrived through `handoff.json` |

---

## Last Words

> "Clean implementation, all tests pass, no blockers or fixes needed. Approved."
>
> — Code Reviewer A

---

## Cause Of Death Rating: PLATINUM

One should-fix is not a stain if it dies quickly and stays dead. The feature remained bounded, the normal workflow was kept out of the blast radius, and the final review had nothing left to bury.

— Dexter, coroner on duty
