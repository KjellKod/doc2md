# CI Trustworthiness

**Quest ID:** ci-trustworthiness_2026-04-05__2258
**Date:** 2026-04-06
**Mode:** workflow (full quest)
**Quality:** Gold 🥇

## Summary

Made doc2md CI more trustworthy by splitting the monolithic CI job, extracting review logic into testable scripts, guaranteeing visible review outcomes on every exit path, adding an intent-review advisory lane, and documenting the required vs advisory check policy.

## Iterations

- Plan iterations: 1 (approved first pass)
- Fix iterations: 2 (GITHUB_OUTPUT semantics, unsupported CLI flag, missing environment gate, empty-file edge case)

## Files Changed

**Modified:**
- `.github/workflows/ci.yml` — split into lint-and-type, test, build jobs
- `.github/workflows/codex-ci-review.yml` — extracted inline Python, added always-visible outcome, advisory marking

**New:**
- `.github/workflows/intent-review.yml` — heuristic intent-review advisory lane
- `scripts/codex_review_post.py` — review output processing (parse, validate, dedup, post)
- `scripts/codex_review_prepare.py` — review preparation (diff fetch, truncation, prompt build)
- `scripts/intent_review.py` — PR description vs diff alignment check
- `tests/unit/test_codex_review_post.py` — 14 tests
- `tests/unit/test_codex_review_prepare.py` — 6 tests
- `tests/unit/test_intent_review.py` — 3 tests (+ 3 existing)
- `docs/ci-check-policy.md` — required vs advisory check policy
- `docs/agentic-ci-guide.md` — candid article on building trustworthy agentic CI

## Agents

| Role | Model | Runtime |
|------|-------|---------|
| Planner | Claude Opus 4.6 | claude |
| Plan Reviewer A | Claude Opus 4.6 | claude |
| Plan Reviewer B | GPT-5.4 | codex |
| Arbiter | Claude Opus 4.6 | claude |
| Builder | GPT-5.4 | codex |
| Code Reviewer A | Claude Opus 4.6 | claude |
| Code Reviewer B | GPT-5.4 | codex |
| Fixer | GPT-5.4 | codex |

## What Started It

> When CI feels opaque, people stop learning from it. When that happens, passing checks start to feel ceremonial.

The gap between "CI passed" and "I trust what CI checked" was the problem. This quest closed it.

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
    {"icon": "⭐️", "title": "First-Pass Arbiter", "desc": "Plan approved on iteration 1"},
    {"icon": "⭐️", "title": "Eleven-File Blitz", "desc": "Builder delivered 11 files in one pass"},
    {"icon": "⭐️", "title": "Always-Visible Guarantee", "desc": "Every review exit path posts a PR comment"},
    {"icon": "⭐️", "title": "Guard Compliance", "desc": "security_ci_guard.py passes for all workflows"},
    {"icon": "⭐️", "title": "26 Tests, Zero Failures", "desc": "Full unit coverage for all new scripts"},
    {"icon": "⭐️", "title": "The Persistent Codex", "desc": "Reviewer B found edge cases across 3 consecutive rounds"}
  ],
  "metrics": [
    {"icon": "📊", "label": "3 independent CI jobs replacing 1 monolith"},
    {"icon": "🔒", "label": "5 failure paths with guaranteed visible PR comments"},
    {"icon": "🧪", "label": "26 unit tests passing"},
    {"icon": "📚", "label": "2 new docs: check policy and agentic CI guide"},
    {"icon": "⚡️", "label": "200+ lines inline YAML Python extracted to scripts"},
    {"icon": "🔧", "label": "1 new advisory intent-review lane"}
  ],
  "quality": {"tier": "Gold", "icon": "🥇", "grade": "B"},
  "quote": {"text": "Plan addresses all 12 acceptance criteria with sound phased approach.", "attribution": "Arbiter, iteration 1"},
  "victory_narrative": "The CI that checks your code should be at least as trustworthy as the code it checks. This quest made that real.",
  "test_count": 26,
  "tests_added": 23,
  "files_changed": 13
}
```
<!-- celebration-data-end -->
