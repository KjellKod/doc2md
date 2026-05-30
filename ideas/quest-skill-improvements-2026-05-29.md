# Quest and Skills improvements, observed running the Markdown-association quest

Source run: quest `markdown-file-association_2026-05-29__1823`, PR #166. Full
workflow mode, end to end (plan, dual review, arbiter, build, dual code review,
fix, re-review), then pushed and shepherded to green CI.

These are grounded in friction and wins from that exact run, not generic advice.
Ordered by expected value.

## 1. Add a code-review arbiter (or a forced reconciliation step)

What happened: at code review, Claude (Reviewer A) returned "clean, approve" and
Codex (Reviewer B) returned three genuine blocking bugs (restore completion never
settling, Help-window checkbox reuse, lost-open on navigation reset). All three
were real and got fixed. The plan phase HAS an arbiter to adjudicate exactly this
kind of A/B disagreement; the code-review phase does not, so the human orchestrator
had to read both reviews and decide. That is the one place in the pipeline where
quality depended on orchestrator judgment rather than a defined agent.

Suggestion: mirror the plan-phase arbiter into code review, OR a cheaper variant:
when reviewer verdicts disagree (one `approve`, one `request_changes`), require a
short third-agent reconciliation that reads both reviews and the diff and emits the
canonical merged findings. Keeps the "human just routes" property the workflow
already aims for.

## 2. Enforce the canonical findings JSON at the agent contract, not the prompt

What happened: the Codex code-reviewer wrote a prose `review_*.md` but not
`review_findings_code-reviewer-b.json`, so the orchestrator had to hand-author the
canonical findings file before `merge-findings` would run. The workflow's reviewer
prompt template does request that JSON, but compliance rode on the orchestrator
remembering to include it.

Suggestion: make the findings JSON a hard part of the reviewer/fixer handoff
contract the way `handoff.json` is, and have a tiny validator reject a review whose
`handoff.next` is `fixer` but which produced no findings JSON. Fail closed, with a
one-line "missing review_findings_<slot>.json" rather than silent orchestrator
repair. (Same pattern that already works well for `handoff.json`: 14/14 compliance
this run.)

## 3. Add a pre-PR "sync base, npm ci, re-validate" gate

What happened: the quest validated green against the branch base at quest start.
Between then and PR time, main had advanced (#161 added a `rehype-stringify`
dependency and touched the same `ShellBridge.swift`). The rebase was textually
clean, but the stale `node_modules` produced a fake typecheck/test failure until
`npm ci`. This is exactly the `feedback_worktree_validation` lesson, hit again.

Suggestion: a closing quest step (before "complete" or as a PR-prep helper) that
rebases/merges onto the live base, runs `npm ci`, and re-runs lint/typecheck/test
(plus the Swift build when macOS files changed). Quests that "passed" should be
proven against the base they will actually merge into, not the one they branched
from.

## 4. Teach the decision policy about repo-hard conventions

What happened: the "no dashes" finding (`// MARK: - Helpers`) was auto-classified
`drop` because it was low severity. But "no em dashes or dashes" is a hard,
non-negotiable repo rule. I had to override the policy and fold it into the fix.

Suggestion: a small repo-convention allowlist (e.g. in `.ai/allowlist.json`) of
finding kinds that get a severity/decision floor and never auto-drop. Encodes
project-specific hard rules so the policy does not silently discard them.

## 5. Bundle the orchestrator's per-phase bookkeeping into one helper

What happened: each phase needed the same manual trio: prepare/truncate artifact
files, append a `context_health.log` line, and run the validated state transition.
That is a lot of hand-run shell with real error surface (one Python one-liner typo
cost a round trip).

Suggestion: a `quest_phase.py advance --phase X --agent Y --runtime Z` that
prepares the expected artifacts for the role, writes the health line, and performs
the `--transition` atomically, returning the next prompt's artifact paths. Shrinks
the orchestrator to "call helper, dispatch agent, read handoff".

## 6. Make `force-push` an explicit, surfaced quest/PR step

What happened: rebasing for a clean PR required a force-push, which the harness
correctly blocked under the working-branch ALLOW exception. "Full permissions" did
not (and should not) auto-authorize a history rewrite. I surfaced it and the user
chose.

Suggestion: pr-shepherd / pr-assistant should treat "branch was rebased -> needs
force-push" as a named decision point with a one-line rationale and an explicit
ask, rather than discovering the block mid-push. Document that broad permission
grants never imply force-push authorization. (This is a good default; keep it.)

## 7. Implement the codex-review skip-on-quota fix (carried debt)

What happened: the `codex-review` CI check showed "skipping" again. Per the PR #160
diary, the real failure mode is `Quota exceeded` exiting 1 with `continue-on-error`,
so the agentic CI reviewer contributes nothing while looking benign. A third
independent reviewer is being left unused.

Suggestion: implement the already-proposed change so quota-exceeded reads as
"skipped" deliberately, and consider routing that CI review through the same local
Codex (Dexter) credential the quest uses, which had quota all through this run.

## What worked and should NOT change

- Full (not solo) routing for this lifecycle-heavy change was correct: the dual
  plan review + arbiter caught a launch-deadlock the single-attempt path would
  have shipped.
- Model-diverse review (Claude + Codex) earned its cost at BOTH plan and code
  stages. Keep the two-model default for substantial/medium-risk work.
- Artifact-path-only prompts + handoff.json + context_health.log kept orchestrator
  context lean and gave clean traceability (100% handoff compliance this run).
- The mandatory plan-presentation summary gave a real intervention point without
  blocking an explicitly end-to-end run.
