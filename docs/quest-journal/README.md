# Quest Journal

| Date | Quest | Outcome |
|------|-------|---------|
| 2026-04-06 | [ci-trustworthiness](ci-trustworthiness_2026-04-06.md) | Split CI into 3 jobs, extracted review scripts, added intent-review advisory lane, guaranteed visible review outcomes. |
| 2026-04-05 | [pr50-review-and-fix](pr50-review-and-fix_2026-04-05.md) | Reviewed PR #50 thread-by-thread, fixed the surviving issues, and landed a clean dual-review pass after two fix loops. |
| 2026-04-04 | [api-tooling](api-tooling_2026-04-04.md) | Built `@doc2md/core`, hardened its batch and CLI contracts through two fix loops, and kept the browser app green. |
| 2026-04-02 | [preview-pane-resizer](preview-pane-resizer_2026-04-02.md) | Added a live desktop divider so Upload and Preview can share width without sacrificing the collapse rail. |
| 2026-04-02 | [preview-pane-collapse](preview-pane-collapse_2026-04-02.md) | Added a desktop collapse rail for the Upload sidebar so the preview pane can reclaim width without a resize system. |
| 2026-03-31 | [linkedin-unicode-preview](linkedin-unicode-preview_2026-03-31.md) | Added a LinkedIn preview mode with refusal-first formatting, isolated runtime behavior, and one clean fix-loop guard. |
| 2026-03-30 | [pdf-quality-signals](pdf-quality-signals_2026-03-30.md) | Added PDF-only quality metadata, preview signaling, and boundary-tested heuristics after a three-iteration fix loop. |
| 2026-03-29 | [repo-quality-cleanup](repo-quality-cleanup_2026-03-29.md) | Added direct helper coverage, stronger App-flow tests, and a bounded `useFileConversion` helper extraction with zero fix iterations. |
| 2026-03-29 | [client-conversion-hardening](client-conversion-hardening_2026-03-29.md) | Added client-side timeout handling so hung conversions stop blocking the queue, with focused queue regression tests and a Vitest boundary fix. |
| 2026-03-29 | [mit-client-followup](mit-client-followup_2026-03-29.md) | Clarified browser-only architecture, surfaced MIT licensing, added provenance guidance, then polished with `llms.txt` and a lint-boundary fix. |
| 2026-03-29 | [converter-consistency](converter-consistency_2026-03-29.md) | Fixed HTML nested list flattening, PDF bullet normalization, PDF line merging. 1 fix iteration after Reviewer B caught list-family bug. |
| 2026-03-29 | [persona-depth](persona-depth_2026-03-29.md) | Deepened Jean-Claude and Dexter persona docs; refined Dexter's edge explicitly, clean dual-review pass. |
| 2026-03-29 | [conversation-hooks](conversation-hooks_2026-03-29.md) | Added cross-agent conversation and journaling hooks to quest workflow. 3 inflection points, non-blocking. |
| 2026-03-28 | [replace-xlsx](replace-xlsx_2026-03-28.md) | Replaced xlsx with read-excel-file, eliminating 2 CVEs. 57 tests green, 0 audit vulns. |
