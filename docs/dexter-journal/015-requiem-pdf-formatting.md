# 015 — Requiem: PDF Formatting Preservation
<!-- quest-id: pdf-formatting_2026-04-06__1833 -->
<!-- pr: #none -->
<!-- style: requiem -->
<!-- quality-tier: Silver -->
<!-- date: 2026-04-06 -->

## ⚰️ Epitaphs

Here lies superscript folding. It stopped ®, ™, and their smaller cousins from wandering off and impersonating headings.

Here lies header and footer stripping. It learned to recognize recurring margin noise and remove it before the living had to read it again.

Here lies kerning-aware spacing. It put "202 6" back together and spared innocent words from needless dismemberment.

Here lies TOC dot leaders. They trailed dots into the dark and took the page numbers with them.

Here lies table detection. It died twice for its assumptions, then came back speaking in x-position clusters instead of raw fragments.

Here lies nested list indentation. It kept bullets in their proper depth and stopped table columns from teaching prose the wrong baseline.

Here lies inline bold spans. It stopped embalming entire lines just because one phrase arrived wearing a heavier font.

## ⚰️ Pallbearers

| Agent | Model | Role | Notes |
|---|---|---|---|
| planner | Claude Opus 4.6 | Planner | Drew a disciplined map for seven heuristics and left the uglier geometry for later inspection. |
| plan-reviewer-a | Claude Opus 4.6 | Plan Critic A | Flagged the missing plumbing before anyone pretended the rendering loop would sort itself out. |
| plan-reviewer-b | GPT-5.4 | Plan Critic B | Saw the interaction traps early and refused to let synthetic confidence pass for evidence. |
| arbiter | Claude Opus 4.6 | Arbiter | Killed the extra planning loop and pushed the work into code, where lies are easier to catch. |
| builder | GPT-5.4 | Builder | Shipped the first body: seven improvements, thirty-five tests, and one table detector still carrying bad instincts. |
| code-reviewer-a | Claude Opus 4.6 | Code Critic A | Kept reopening the chest cavity until the row logic, page geometry, and regressions all matched anatomy. |
| code-reviewer-b | GPT-5.4 | Code Critic B | Checked the acceptance criteria against the wound pattern and kept the verdict clinical. |
| fixer | GPT-5.4 | Fixer | Rebuilt table clustering, restored hasEOL boundaries, and taught detectBaseX to stop drinking from the table rows. |

## 💀 Coroner's Report

Seven PDF formatting improvements shipped in src/converters/pdf.ts, all driven by existing pdfjs-dist positional data rather than new dependencies. Cause of death: feature complete, after the converter finally learned to fold superscripts, strip recurring margins, respect kerning, clean TOC leaders, recover tables, preserve nested lists, and mark inline bold without hallucinating structure. Complications were not decorative: table detection first trusted raw item positions, then had to be rewritten around x-position clustering, and then nearly mangled same-y rows until hasEOL was restored as a hard boundary. The procedure ended with 41 PDF tests and 233 total tests passing.

## 📜 Last Words

> "I did not find a remaining correctness defect in the reviewed diff"

## ☠️ Quality Tier: Silver

Two fix iterations and three review passes left clear tool marks, but the final reviewers approved with no remaining findings and the test suite stayed upright.

---

Content by Dexter. Rendered by Jean-Claude.
