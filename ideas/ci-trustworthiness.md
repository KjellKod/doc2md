# CI Trustworthiness

## Summary

`doc2md` should make its CI easier to trust by making results more legible, review automation less opaque, and unstable checks clearly advisory until they earn required-check status.

This is not about adding more checks for their own sake. It is about reducing the gap between what CI reports and what a reviewer can confidently believe.

## Problem

The current CI works, but it has a few trust gaps:

- the main CI pipeline is a single job, so failures are noisier than they need to be
- Codex review can complete successfully with no visible PR comment, which looks suspicious even when the workflow did run
- review logic lives mostly inline in workflow YAML, which makes it harder to evolve safely
- large PR diffs get truncated, but that limitation is not surfaced clearly enough to humans
- all checks look equally authoritative even when some would be better treated as advisory first

When CI feels opaque, people stop learning from it. When that happens, passing checks start to feel ceremonial.

## Goal

Make `doc2md` CI more trustworthy by improving:

- **clarity**: failures should say what failed and where
- **honesty**: review automation should report when it had little or no useful output
- **traceability**: review processing should have explicit result artifacts
- **graduated enforcement**: unstable checks should be advisory before they become required

## What Good Looks Like

Reviewers and maintainers should be able to tell, quickly:

1. which quality gate failed
2. whether an AI review actually ran
3. whether “no comments” means “clean” or “silent failure”
4. which checks are hard blockers versus informative signals

## Proposed Direction

### 1. Split the monolithic CI job

Current `ci.yml` runs lint, typecheck, tests, and build in one job.

Split it into at least:

- `lint-and-type`
- `tests`
- `build`

Benefits:

- clearer failure ownership
- cheaper reruns
- easier promotion of specific jobs into required checks

### 2. Add reusable CI via `workflow_call`

Follow the pattern used in stronger repos where release or deploy flows reuse the main CI workflow instead of rebuilding the same setup steps independently.

Use cases:

- Pages deploy should be able to depend on the shared CI definition
- future release flows should not duplicate install/test/build logic

### 3. Move Codex review processing into helper scripts

The current review workflow does too much inline in YAML.

Extract into scripts with explicit phases:

- `prepare`
- `process`
- `summarize`

Benefits:

- easier local debugging
- easier unit testing of review parsing and dedup behavior
- easier iteration on summary comments, fallback logic, and truncation reporting

### 4. Always post a visible review outcome

Even when Codex returns:

- `[]`
- malformed-but-non-empty output
- only duplicate or already-resolved findings

the workflow should leave a visible PR comment or summary signal.

The important distinction is:

- **no actionable findings**
- **review produced nothing useful**

Those are not the same outcome and should not look the same to humans.

### 5. Add an intent-review lane

Separate “is this code risky or wrong?” from “does this PR match the actual ask?”

An intent-review workflow should focus on:

- scope creep
- missing requested work
- mismatch between PR body and code
- suspicious omissions in acceptance criteria coverage

This is especially useful for quests and large PRs where the code may be technically fine but still not satisfy the user’s request.

### 6. Introduce advisory lanes for fragile checks

Some checks should prove themselves before they become required.

Examples:

- package/install smoke checks
- Pages packaging verification
- large end-to-end scenarios

Pattern:

- run them in CI
- summarize pass/fail clearly
- mark them advisory first
- promote them to required only after they are stable and useful

### 7. Surface review limitations explicitly

When the review workflow truncates a diff or narrows context, the result should say so in a human-visible way.

Examples:

- diff truncated to 100 KB
- only first N files inspected deeply
- output was empty after parse

That keeps reviewers from over-trusting a green “Codex review” check that actually saw only part of the PR.

## Suggested Implementation Phases

### Phase 1: Trust the output

- split `ci.yml` into multiple jobs
- make Codex review always emit a visible summary
- include truncation/empty-result messaging in PR-visible output

### Phase 2: Trust the process

- move review parsing/posting into helper scripts
- add explicit result artifacts and summaries
- make review behavior easier to test locally

### Phase 3: Trust the scope

- add intent-review
- add one or two advisory non-blocking lanes
- promote only proven checks into required branch protection

## Validation

The idea is working when:

- a failing lint error is obviously distinct from a failing build
- a “no Codex comments” run still leaves a visible explanation on the PR
- maintainers can inspect review-processing logic outside of giant YAML blocks
- advisory checks provide signal without training people to ignore required checks

## Why This Matters

Trustworthy CI does not just catch bugs. It teaches everyone reading it what happened, what was checked, and what still requires judgment.

That is the difference between automation that helps and automation that merely blinks green.
