# Quest Journal: CI Review Hardening

**Quest ID:** `ci-review-hardening_2026-04-08__1949`
**Date:** 2026-04-08
**Outcome:** Complete (Gold)
**Quest Mode:** Workflow (full)

## Summary

Implemented 6 CI review hardening patterns from `ideas/ci-review-hardening-patterns.md`: trust zone documentation via env-scoping, untrusted content delimiters with `sanitize_untrusted()`, SHA pinning for all actions, trusted execution rule comments, diff-range validation (side-aware LEFT+RIGHT), and partial coverage surfacing in review summaries.

## Iterations

- **Plan iterations:** 2 (arbiter caught overstated trust-zone isolation, missing commit-message scope, narrow sanitization)
- **Fix iterations:** 1 (6 issues from dual review, all resolved in one pass)

## Files Changed

| File | Change |
|------|--------|
| `.ai/allowlist.json` | Set `fix_loop: true` |
| `.github/codex-review-prompt.md` | Added `<untrusted_content>` delimiters around each placeholder |
| `.github/workflows/codex-ci-review.yml` | SHA pinning, trust-zone comments, env-scoping, PR-head prompt fetch |
| `scripts/codex_review_post.py` | Diff-range validation, side-aware LEFT/RIGHT, partial coverage surfacing, summary enhancements |
| `scripts/codex_review_prepare.py` | `sanitize_untrusted()`, `parse_diff_ranges()` with LEFT+RIGHT, `diff_ranges.json` output |
| `tests/unit/test_codex_review_post.py` | Boundary tests, AC6 function tests, deleted-line regression tests |
| `tests/unit/test_codex_review_prepare.py` | Sanitization tests, diff-range tests, rename handling, deleted-line range tests |

## Test Results

55 tests passing (up from 46 pre-build, 21 pre-quest)

## Agent Invocations

14 total, 100% handoff.json compliance (7 Claude, 7 Codex)

## Key Decisions

- AC1: Defense-in-depth documentation, not real isolation (single-job architecture preserved)
- AC2: Commit messages excluded (YAGNI, review system does not fetch them)
- Sanitization applied to all 4 interpolated payloads before template substitution
- Diff-range validation is side-aware: LEFT ranges for deleted lines, RIGHT for added

## Origin

From idea file: `ideas/ci-review-hardening-patterns.md`

> doc2md could make its CI review flows more robust by tightening trust boundaries and making review outcomes easier to read. This is not mainly about more automation. It is about making the current automation safer, more legible, and less likely to fail silently.

## Celebration Data

<!-- celebration-data-start -->
```json
{
  "quest_mode": "workflow",
  "agents": [
    {"name": "Planner", "model": "Claude Opus 4.6", "role": "planner"},
    {"name": "Plan Reviewer A", "model": "Claude Opus 4.6", "role": "plan-reviewer-a"},
    {"name": "Plan Reviewer B", "model": "GPT-5.4", "role": "plan-reviewer-b"},
    {"name": "Arbiter", "model": "Claude Opus 4.6", "role": "arbiter"},
    {"name": "Builder", "model": "GPT-5.4", "role": "builder"},
    {"name": "Code Reviewer A", "model": "Claude Opus 4.6", "role": "code-reviewer-a"},
    {"name": "Code Reviewer B", "model": "GPT-5.4", "role": "code-reviewer-b"},
    {"name": "Fixer", "model": "GPT-5.4", "role": "fixer"}
  ],
  "achievements": [
    {"icon": "🔒", "title": "Trust Cartographer", "desc": "Mapped three trust zones across a single-job workflow without pretending env blocks are walls"},
    {"icon": "🛡️", "title": "Prompt Boundary Keeper", "desc": "sanitize_untrusted() applied to all 4 interpolated payloads, no escape routes left"},
    {"icon": "📌", "title": "SHA Undertaker", "desc": "Buried floating action tags under immutable commit SHAs"},
    {"icon": "🔧", "title": "One-Shot Fixer", "desc": "6 review findings, all resolved in a single pass, 55 tests breathing"},
    {"icon": "📋", "title": "Full Compliance", "desc": "14/14 handoff.json compliance, zero text fallbacks"}
  ],
  "metrics": [
    {"icon": "🪦", "label": "6 hardening patterns shipped"},
    {"icon": "🧪", "label": "55 tests passing (from 21 pre-quest)"},
    {"icon": "⚰️", "label": "14 agent invocations, 100% handoff compliance"},
    {"icon": "🦇", "label": "678 lines added, 21 removed"}
  ],
  "quality": {"tier": "Gold", "icon": "🥇", "grade": "B"},
  "quote": {"text": "Post-fix re-review passed: all 6 items resolved, no remaining issues, approve.", "attribution": "Code Reviewer A, final verdict"},
  "victory_narrative": "The CI review pipeline learned to be honest about its boundaries: what it can isolate, what it actually reviews, and how much of the diff it covered. Six patterns, two plan iterations, one clean fix pass.",
  "test_count": 55,
  "tests_added": 34,
  "files_changed": 7
}
```
<!-- celebration-data-end -->
