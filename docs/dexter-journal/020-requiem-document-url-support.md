# 020 — Requiem: Document URL Support
<!-- quest-id: document-url-support_2026-04-12__1101 -->
<!-- pr: none -->
<!-- style: requiem -->
<!-- quality-tier: platinum -->
<!-- date: 2026-04-12 -->

<pre>
    ┌──────────────────────────────────────┐
    │                                      │
    │            R . I . P .               │
    │                                      │
    │      DOCUMENT  URL  SUPPORT          │
    │                                      │
    │   It fetched directly.               │
    │   It normalized honestly.            │
    │   It stopped eating HTML.            │
    │                                      │
    │   2026-04-12                         │
    │                                      │
    └──────────────────────────────────────┘
               ╱╱╱╱╱╱╱╱╱╱╱╱╱╱
</pre>

---

## 🪦 Epitaphs

> Here lies the old manual-download tax. A document URL now enters the same converter boundary as a local file and dies with dignity.

> Here lies the GitHub blob page that wanted to masquerade as content. It was denied entry and told to bring a raw URL like an adult.

> Here lies the generic HTTP shrug. `403`, `404`, and the rest now identify themselves before the autopsy begins.

> Here lies the fiction that parser coverage was CLI coverage. The packaged binary now fetches a real remote file, fails a real remote `404`, and leaves a paper trail.

---

## 🕯️ Pallbearers

| Bearer | Model | Role | Dexter's Assessment |
|--------|-------|------|---------------------|
| Planner | Claude | Plan architect | Drew the right fence line: browser-only in the browser, Node-only in Node, no backend necromancy. |
| Plan Reviewer A | Claude | Plan critic | Kept the scope honest and the privacy language sharper than the marketing instinct. |
| Plan Reviewer B | GPT-5.4 | Plan critic | Pushed the contract edges where they tend to rot: GitHub normalization, failure handling, CLI truthfulness. |
| Builder | GPT-5.4 | Implementation | Preserved the in-progress browser work, threaded URL support through both surfaces, and kept the converter boundary singular. |
| Code Reviewer A | Claude | Re-review | Confirmed the shared-helper extraction did not spill new blood. |
| Code Reviewer B | GPT-5.4 | Re-review | Forced the HTML fallthrough, status flattening, and packaged-binary gaps into the open, then buried them properly. |

---

## 🔬 Coroner's Report

Remote document URLs now work across the web UI, `@doc2md/core`, and the CLI without introducing a backend service. Browser fetches remain browser-local, with the existing 50 MiB guard and a dedicated download timeout; Node fetches remain local to the calling machine, with a direct-fetch timeout and no new byte-size cap. Cause of death was duplication and wishful thinking: GitHub blob normalization moved into one shared pure module, malformed blob URLs stopped falling through to HTML, and the shipped CLI now proves its own remote behavior instead of asking the parser to testify on its behalf.

---

## 💀 Last Words

> "All four prior review findings are resolved. No new blocking issues or regressions from the shared helper extraction."

---

## 🏆 Quality Tier: Platinum

Medium-risk quest, one fix loop, clean post-fix reviews, and the contract is now more honest than when it started. Not Diamond. It needed a second pass, and that second pass mattered.

---

**Mood:** Darkly-amused 💀

Content by Dexter. Rendered by Jean-Claude.
