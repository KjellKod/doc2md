# 019 — CI Review Hardening

<!-- quest-id: ci-review-hardening_2026-04-08__1949 -->
<!-- date: 2026-04-08 -->

Six patterns walked into the CI pipeline and none walked out unchanged.

The idea doc was straightforward: tighten trust boundaries, pin actions, validate model output, be honest about coverage gaps. What made it interesting was what the arbiter caught in the first plan iteration. Three things that would have shipped as comfortable fictions: env-scoping described as real isolation (it is not, in a single-job workflow), commit messages listed in scope despite never being fetched, and sanitization that covered only two of four untrusted payloads.

The revised plan was cleaner for being honest about those limits. AC1 says "defense-in-depth documentation" now, not "the model step does NOT have access." That is the difference between a security claim and a security label, and the label is the correct choice here.

The builder wired it through without drama. Codex (GPT-5.4) handled both build and fix, and did so cleanly. The code review found six real issues, the most interesting being Reviewer B's catch that diff-range validation was silently dropping valid deleted-line findings. The fixer added side-aware LEFT/RIGHT range tracking and brought the suite from 46 to 55 tests.

Fourteen agent invocations, fourteen compliant handoff.json files. That is the kind of infrastructure plumbing that does not draw applause but quietly earns it.

The allowlist also got a small update: `fix_loop` flipped to `true` at Kjell's request. One less approval gate, one more step toward the workflow running as a continuous unit when the human trusts the process.

Dexter held the requiem. Darkly amused, as is his way with things that die of completion.

---

**Post-followup (2026-04-08):** The SHA-pinned actions broke the Codex CI review workflow in a way that was not obvious. Full commit SHA references (`actions/checkout@93cb6efe...`) combined with GitHub environment protection rules (required reviewer approval) produce a `startup_failure` instead of the expected "waiting for approval" state. No jobs are created, no logs exist, and the check sits as "Expected" forever in the PR checks list. Tag references (`@v5`, `@v6`, `@v7`) work correctly with the same environment configuration. Reverted to tag refs.

This appears to be a GitHub Actions limitation: the runner cannot resolve a SHA-pinned action reference before the environment approval gate fires, so the entire run fails at startup. Worth knowing for any workflow that combines SHA pinning with deployment environments. The security benefit of SHA pinning is real, but not if it silently kills the workflow it protects.

Also fixed the intent review script (`scripts/intent_review.py`) to find and PATCH its existing comment instead of posting a new one on every `synchronize` event. The PR had accumulated six identical "Intent Review Summary" comments, one per push.

— Jean-Claude
