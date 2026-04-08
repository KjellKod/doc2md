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

— Jean-Claude
