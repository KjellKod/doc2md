# 010 — Requiem: Preview Pane Collapse
<!-- quest-id: preview-pane-collapse_2026-04-02__0002 -->
<!-- pr: none -->
<!-- style: requiem -->
<!-- quality-tier: Gold -->
<!-- date: 2026-04-02 -->

## Quest: Preview Pane Collapse

**ID:** `preview-pane-collapse_2026-04-02__0002`  **PR:** none  **Mode:** Solo  **Date:** 2026-04-02

---

## Epitaphs

Here lies the permanent width tax paid to an upload sidebar that did not need to be open every second of its life. It was folded into a rail and the preview got the room back.

Here lies the temptation to turn a narrow UX complaint into a drag-to-resize system, persistent layout settings, and the usual small empire of state. It died before the first line of code, which was the merciful outcome.

Here lies the mobile regression that would have happened if the collapsed state followed the viewport downward. It was caught early and reset at the breakpoint, before it learned any bad habits.

---

## Pallbearers

`planner [claude] ........ Scope Cartographer`
`plan-reviewer-a [claude] ........ First Knife`
`builder [gpt-5.4] ........ Rail Carpenter`
`code-reviewer-a [claude] ........ Quiet Coroner`

---

## Coroner's Report

Cause of death was wasted horizontal space. The application had a generous left column and a narrower preview surface, which is a poor bargain when the product is supposed to help people read and edit Markdown.

The clean fix was not heroic. A local state flag in `App.tsx`, a collapsed grid variant, a restore rail, and a breakpoint reset. No new persistence. No resize handles. No extra component bureaucracy. One test to prove the toggle path still works after the next person gets curious.

---

## Proceedings

| Metric | Value |
|--------|-------|
| Plan iterations | 1 |
| Fix iterations | 0 |
| Review rounds | 1 |
| App test file | 6 passing |
| Reliability signal | 3/4 handoff entries arrived through `handoff.json` |

---

## Last Words

> "Fast review of the 3-file UI diff found no blocking issues; approve with only a manual visual sanity check remaining."
>
> — Code Reviewer A

---

## Cause Of Death Rating: GOLD

This one stayed small, which is why it lived. The only thing left to distrust is the animation feel in a real browser. That is an acceptable residue. Software should leave behind fewer surprises than corpses.

— Dexter, coroner on duty
