# CI Check Policy

This repo separates required checks from advisory checks on purpose.

## Required checks

These are the checks that should block merge:

- `lint-and-type`
- `test`
- `build`
- `ci`
- `pr-body-gate`
- `secret-scan`
- `workflow-guard`

## Advisory checks

These checks should stay non-blocking until they prove they are consistently useful:

- `advisory: codex-review`
- `advisory: intent-review`

They still run on real PRs. They can still fail. They just do not get to stop a merge by themselves.

## Why the split exists

Required checks answer direct build health questions:

- Does the code lint?
- Does it typecheck?
- Do tests pass?
- Does the app build?
- Do workflow and PR hygiene rules hold?

Advisory checks answer softer questions:

- Did the automated reviewer find something worth looking at?
- Does the PR description match what actually changed?

Those checks are useful, but they are still learning the repo. Treating them as required too early would train people to ignore CI instead of trusting it.

## Promotion rule

An advisory check can be promoted to required after all of the following are true:

1. It has at least 10 consecutive green or intentionally-explained runs on real PRs.
2. Maintainers have not seen recurring false positives or silent failures during that stretch.
3. The check leaves a visible PR outcome every time it runs.
4. Branch protection is updated deliberately after the team agrees the signal is trustworthy.

If any of those stop being true, demote it back to advisory first and fix the trust problem before trying again.

## Branch protection note

The workflow now keeps a `ci` aggregator job alongside the split `lint-and-type`, `test`, and `build` jobs. That preserves current branch protection while the repo migrates to the more specific check names.
