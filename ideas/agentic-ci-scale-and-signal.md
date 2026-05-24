# Agentic CI: Scale and Signal

Status: active proposal.

Predecessor: [`archive/ci-trustworthiness.md`](archive/ci-trustworthiness.md) shipped
in PR #140 and made the lane honest about itself. This proposal makes the lane
useful at every PR size and risk level.

Cross-repo reference: the [Quest CI review pipeline](https://github.com/KjellKod/quest)
has already shipped a working version of the largest piece below (partitioned
review with whole-file and chunked context). Where moves in this proposal
overlap with Quest behavior, we should port their implementation rather than
redesign from scratch. Specific reference points are noted inline.

## Summary

The current agentic CI is trustworthy at the boundary (gates, sandboxing,
always-visible outcome) but it does not yet scale with the diff. A three-line
typo and a five-thousand-line refactor get the same single Codex pass. Large
diffs get silently truncated at 100 KB and the review honestly reports its own
blindness, which is the right behavior for a failed review but not a substitute
for a successful one. There is no loop that confirms a flagged issue was
actually addressed. There is no project memory of architectural rules the
reviewer has already agreed with us on. And the Mac test suite that has caught
real WebKit policy bugs only runs on a human laptop.

This proposal adds five changes that turn agentic CI from "reports its own
state" into "produces a useful outcome for the PR in front of it."

## Problem

Concrete gaps observed on shipped PRs:

1. **Truncation is dishonest in the way that matters.** `codex_review_prepare.py`
   truncates at 100,000 bytes and emits `--- DIFF TRUNCATED ---`. The summary
   comment surfaces this. But a 500 KB PR effectively gets a 20 percent review
   while every check still shows green. Honesty about the gap does not close
   the gap.

2. **Every PR pays the full review cost.** A docs-only change, a dependency
   bump, and a security-sensitive refactor all consume the same Codex budget,
   the same prompt size, the same 300-second timeout window. The signal is
   diluted on small PRs (Codex over-comments on trivia) and underweight on
   large ones (where the timeout, the truncation, or the model's attention
   budget runs out before the risky file is read).

3. **No verification that fixes addressed findings.** Codex posts inline
   comment. Human (or Jean-Claude) pushes a fix. The deduplicator at
   `scripts/codex_review_post.py:140` notices the comment body is similar and
   suppresses a re-post. That is not the same as confirming the new code
   actually addresses the original concern. Resolution today is by human
   judgment alone.

4. **Project rules learned the hard way are not durable.** The diary on
   2026-05-20 records that Codex caught two regressions on PR #138 that
   violated principles already established in this repo: a `node` prop leaking
   onto the DOM, an unpinned localhost port that turned the shell into a
   browser. Codex caught those because they were visible in that one diff. It
   would not have caught them by reference to "the desktop is not a browser"
   because that principle lives nowhere the reviewer reads.

5. **Mac Swift tests do not run in PR CI.** `apps/macos/doc2mdTests/`
   carries 36 tests (`WebShellLinkPolicyTests`) plus older suites that are the
   only thing covering WebKit navigation policy, the URL classifier, and the
   external opener boundary. Cloud PR CI intentionally no longer builds the
   `.app`; Mac-sensitive PRs rely on maintainer-local validation via
   `npm run validate:mac`.

## Goal

Agentic CI produces a real outcome scaled to the PR:

- a small PR is reviewed quickly, sparsely, and is not buried in commentary
- a large PR is reviewed in full, by partitioning the diff rather than
  truncating it
- a risky PR is reviewed with extra depth, including a second pass
- a fixed finding is confirmed addressed, not just deduped
- a known project rule is enforced as a constraint, not rediscovered each time
- the Mac test suite blocks merge the same way the web test suite does

## What Good Looks Like

Reviewers, maintainers, and the principal author can answer:

1. Did the reviewer read the whole diff, or only part of it?
2. Was this PR routed to the right review depth for its risk?
3. Did the reviewer apply the project rules we have already agreed on?
4. Are previous findings confirmed addressed by the latest push?
5. Did every platform's tests run, or only the ones convenient for the runner?

## Proposed Direction

### 1. Partitioned review for large diffs

Replace single-shot truncation with a partition-and-synthesize loop in
`codex_review_prepare.py` and a new `codex_review_synthesize.py`.

Reference implementation: Quest's `.github/scripts/codex_review.py` already
implements a "Deep CI" chunked-context pass with stable omission reason
codes (`excluded-path-segment`, `lockfile`, `unsupported-extension`,
`minified-file`, `deleted-file`, `metadata-too-large`, `fetch-too-large`,
`total-cap-exhausted`, `no-changed-line-ranges`, `chunk-cap-exhausted`,
`unavailable`) and a manifest written to
`/tmp/deep_ci_context_manifest.json`. Quest constants worth borrowing as
starting points: `MAX_FILES=3`, `MAX_CHUNKS_PER_FILE=4`,
`MAX_CHUNK_CHARS=12000`, `MAX_TOTAL_CHARS=60000`. Their `<deep_ci_files>`
prompt section, plus the instruction that "chunked context is partial: do
not infer findings that require omitted code unless the diff itself proves
the issue," is the prompt-side discipline we need too.

Behavior:

- if the diff fits in budget, run one pass as today
- if it does not, partition by changed file (and within a file by hunk run
  if a single file exceeds the budget), run one Codex pass per partition with
  the same prompt template plus a "this is partition N of M, focus on this
  file's correctness against the rest of the changed surface" hint
- aggregate per-partition findings, dedupe across partitions on (path, line,
  jaccard) using the existing similarity helper, then post all valid
  comments inline through the existing publish path
- write a single summary comment listing partition count, total bytes
  reviewed, per-partition exit codes, and which partitions hit the timeout

Cost shape: budget is N partitions * 300 s timeout. For a typical large PR
this is two to five Codex calls. Cap total at ten partitions; beyond that,
post a summary saying so and review the top-ten-by-risk partitions only.

Why this and not a bigger context window: even with a larger context, the
attention budget on a 500 KB diff is real and the model misses things deep
in the prompt. Partition with synthesis beats one giant prompt, and it works
with any future model swap.

### 2. Risk router

Add a fast pre-classifier (`scripts/codex_review_route.py`) that runs before
the review prep step and writes a single category to GitHub output:

- `skip`: changed files are docs-only, lockfile-only without security
  advisories, or a single allowlisted ignorable area
- `light`: typical PR. One Codex pass, default depth, lower-volume severity
  output
- `deep`: PR touches a path on the risk-sensitive allowlist
  (`.github/workflows/`, `scripts/security_ci_guard.py`,
  `apps/macos/doc2md/`, `src/core/conversion/`, anything under
  `scripts/release/`, package.json/package-lock.json with new dependencies),
  or the diff is larger than the partition threshold. Run partitioned
  review (move 1) plus a second model pass (Claude or a different prompt
  configuration) and surface disagreement as its own annotation lane

Classification is rules-first to stay cheap and predictable; a future
upgrade can layer an LLM call for ambiguous cases. The category is written to
metadata and surfaced in the summary comment so humans can see why the PR got
the depth it got.

### 3. Findings-to-fix verification

When a new commit lands on a PR with prior Codex findings, before running a
fresh review, run a focused re-read pass:

- input: the changed lines in the new commit plus each prior finding's
  (path, line, body)
- prompt: "for each prior finding, classify the new state as `addressed`,
  `partially-addressed`, `unchanged`, or `out-of-scope`. Quote the changed
  lines that demonstrate the classification."
- output: a structured update appended to the existing summary comment, not
  a new comment, with each prior finding's status

Effect: a PR that ships fixes for three Codex comments shows three confirmed
addressed entries, not a dedup silence. A PR that ships unrelated work shows
the prior findings as still unchanged, and the reviewer knows the next push
is the one to watch.

### 4. Project knowledge injection

Create `.github/codex-review-rules.md` with durable architectural rules that
the prompt template prepends as `<project_rules>` (a new placeholder section
in `codex-review-prompt.md`).

Adjacent borrow from Quest: their prompt template includes explicit
"Thread-awareness rules" that tell the reviewer to read the existing PR
comment thread, treat human replies (acknowledged, intentional, won't
fix, explained) as resolution, and stay silent rather than re-raise.
Port that block into our prompt template next to project rules. We
currently dedupe at post time with a Jaccard threshold, which is
strictly worse than not generating the duplicate in the first place.

Seed content from rules already paid for in past PRs:

- "the desktop is not a browser; external links open in the system default,
  never inside the shell" (from PR #138)
- "no native HTML title tooltips; use the project's custom tooltip
  component" (from PR #138 follow-up)
- "tests touching the database must hit a real database, not mocks"
  (general)
- "no destructure of mdast `node` onto rendered DOM" (PR #138 regression)

Rules are added by PR. The file lives at `.github/` so it inherits the same
trusted-base staging path the prompt template already uses. The rules are
enforced as review constraints, not nits: a finding that contradicts a rule
is `high` severity by default.

### 5. Mac Swift Tests in Local Validation

Extend `npm run validate:mac` to run:

```bash
xcodebuild -only-testing:doc2mdTests test -project apps/macos/doc2md.xcodeproj -scheme doc2md
```

Do this after the current cost-reduction slice settles, so the local Mac
validation command remains the single maintainer-owned gate for Mac-sensitive
PRs.

## What we keep that Quest does not have

Two doc2md-only behaviors deliberately stay in place even after we port
Quest's depth machinery:

1. **Always-post-summary contract** in `codex_review_post.py`. Every
   terminal path posts a visible PR comment (timeout, malformed JSON,
   empty findings, all deduped, all out-of-range). Quest's lane currently
   goes silent on a clean Codex exit with no findings. The honest output
   contract is doc2md's most load-bearing trust property and must not
   regress when we port partitioned review.

2. **Post-step diff-range validator** that drops findings outside changed
   hunks with a `::notice` annotation. Quest passes ranges into the prompt
   as guidance only; we validate after the fact too. Keep both layers when
   the chunked context lands, because chunked context expands the surface
   the model sees and the post-step validator is what keeps inline
   comments anchored to actual changes.

3. **Helper script phase split** (`codex_review_prepare.py` plus
   `codex_review_post.py`). Quest has one monolithic 1700-line file. We
   keep the split because it lets us unit-test each phase in isolation
   and upload the prepared inputs as a forensic artifact. When move 1
   adds a `codex_review_synthesize.py`, that becomes a third phase, not
   a merge of the existing two.

## Smaller adjacent wins

Worth doing alongside the five moves above, ordered by ratio of value to
effort:

1. **Conversion perf budget on a fixture corpus.** Add a fast conversion
   benchmark over `test-fixtures/` and post timing as an advisory comment.
   Promote to required once stable. Catches the "100 MB DOCX got 3x slower"
   regression class that user reports surface late.

2. **Web bundle determinism check.** Mirror
   `scripts/release/check_dmg_determinism.sh` for `npm run build` output.
   Two consecutive builds should produce identical hashes for the same input.

3. **Dependency security delta on lockfile changes.** When
   `package-lock.json` changes, run `npm audit --json` against the old and
   new lockfiles and post the delta only. Today an audit run on every PR is
   noisy; the delta is signal.

4. **Test impact gate (advisory).** A check that flags PRs adding new
   branches in `src/` (heuristic: new `if`/`switch`/early-return lines)
   without any test diff under `src/**/__tests__/`, `tests/`, or
   `*.test.{ts,tsx}`. Advisory only; lots of false positives on refactors.

## Suggested Implementation Phases

### Phase 1: Stop pretending on large PRs

- ship move 1 (partitioned review)
- update the summary comment to list partition outcomes
- update `docs/agentic-ci-guide.md` so the contract is "the reviewer read the
  whole diff" not "the reviewer honestly admits it did not"

### Phase 2: Route to the right depth

- ship move 2 (risk router)
- add the `skip` lane and watch it for one to two weeks before tightening
- decide whether `deep` triggers a second-model pass now or later

### Phase 3: Close the loop and inject memory

- ship move 3 (findings-to-fix verification)
- ship move 4 (project rules file) seeded with the four rules above
- review rule additions through normal PR review like any other policy doc

### Phase 4: Mac parity and adjacent wins

- ship move 5 (Swift tests in CI), the cheapest blocking improvement here
- pick one or two adjacent wins per quarter; promote to required only after
  proven

## Validation

The idea is working when:

- a 1000-line PR shows a per-partition outcome list, not a truncation notice
- a docs-only PR completes review in seconds with a "skip" summary, not a
  full Codex pass
- a follow-up commit on a PR shows prior findings re-classified as
  `addressed` rather than silently deduped
- a violation of a rule in `codex-review-rules.md` lands as a `high`
  severity finding citing the rule by name, not as a rediscovered concern
- a regression to `WebShellLinkPolicy.swift` fails CI on PR, not on the
  reviewer's laptop

## Why This Matters

The first round of CI work made the lane honest. That earned the right to
make it useful. A reviewer who says "I read the whole thing" and means it is
worth ten reviewers who say "I read some of it but I am telling you so."

Robustness here is not about catching more bugs in absolute terms. It is
about making the bug-catching budget proportional to the risk in front of
it, so the reviewer is sharp on the PRs that matter and out of the way on
the PRs that do not. Both ends of that range create real outcomes; the
middle is where current automation gets stuck.
