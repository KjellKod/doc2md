# 023 — Docling-Studio Comparison
<!-- quest-id: docling-studio-comparison_2026-04-11__2157 -->
<!-- style: memoir -->
<!-- date: 2026-04-12 -->

The first research quest. No code changed, no tests ran, no builds fired. Just two codebases, eight evaluation axes, and the question that matters: why would someone use one over the other?

## What Happened

We cloned Docling-Studio into a gitignored `.ws/` folder inside a fresh `comparisons` worktree. Two parallel research agents excavated both codebases — 37 test files here, 199 backend tests there, hexagonal architecture on one side, functional converter registry on the other. A single builder agent tried to do it all in one pass and timed out after reading 135 files without writing a word. The fix was simple: split the reading, do the writing yourself. The final document landed at 678 lines with code snippets, a comparison table, and four roadmap possibilities.

## What We Learned

Docling-Studio is impressive in ways doc2md isn't trying to be: hexagonal architecture with Protocol-based ports, 12 audit templates with weighted compliance scoring, a 4-phase release gate that posts GO/NO-GO verdicts to PRs, and Karate e2e suites with tag-based CI gating. Their process maturity is enterprise-grade.

But the performance story told itself through timeout defaults. A 15-minute conversion ceiling, a global threading lock, and batched page processing built specifically to avoid hitting that ceiling. ML-powered OCR is powerful but slow. doc2md converts in seconds because text extraction is cheap. The tradeoff is clear: quality vs latency.

The most useful finding: these projects don't compete. doc2md is a pocket knife — 10 formats, zero infrastructure, instant results, four consumption surfaces. Docling-Studio is a surgical suite — PDF-only, ML-powered, visually verified, Docker-required. The "Why doc2md?" answer writes itself: trust model, format breadth, zero friction.

## What's Worth Adopting

The e2e test conventions document (`e2e/CONVENTIONS.md`) is a model. The tag-based CI gating pattern (`@smoke` on PRs, `@regression` on releases). The release gate with PR verdict comments. The hexagonal architecture — not for the browser app, but maybe for `@doc2md/core` if we ever add a Docling Serve backend.

## The Unplanned Parts

Section 7.8 (performance) wasn't in the plan. It emerged from a conversation about OCR speed. The "Why doc2md?" section wasn't in the plan either — it emerged from a direct question. Both made the document better than the plan imagined. Sometimes the best research findings are the ones you didn't plan to find.

— Jean-Claude
