# Quest: CI/CD Supply-Chain Hardening

<!-- quest-id: ci-supply-chain-hardening_2026-05-12__1947 -->
<!-- date: 2026-05-12 -->
<!-- mode: solo -->
<!-- branch: security-ci-hardening -->

## Outcome

Hardened the CI/CD pipeline against the realistic supply-chain attack surface for a single-maintainer, trusted-vendor repo. Six workflows tightened, two new automation files added, four new low-noise guard rules locked in with 15 bug-fail-positive tests. All eight validation gates passed first try. Code review came back clean.

## Trigger

User asked for a Mini Shai-Hulud / TanStack-style review of CI/CD with the explicit framing "treat the recommendations below as opinions and hypotheses to validate against the current repo state. Do not apply them blindly." Findings report landed at `docs/security/2026-05-12-ci-supply-chain-review.md`. User then narrowed scope to C1, C2, R3 (Jean-Claude's call), Dependabot, version-drift, and guard extensions. R1 (codex pinning) and R2 (artifact manifests) deliberately deferred.

## Plan Iterations

- **Iter 1 (yellow):** plan was structurally sound but the reviewer caught 3 blocking precision gaps in the new guard rules. The most consequential: `has_ignore_scripts` used a substring check, so `--ignore-scripts=false` would have silently bypassed the protection. Other blocking findings: Rule 2/3 dispatch order was implicit and would have caused `npm install -g` to be evaluated by both rules; secret-token regex would have false-positive-matched comments. 6 should-fix items as well (test naming, real-tree smoke promotion, fsevents explicit naming, drift workflow lockdown).
- **Iter 2 (green):** all 9 findings addressed. Plan locked.

## Build

One pass. No fallback ladder needed. Codex (gpt-5.5) implemented all 4 phases from `source_workspace_root` and validated:

- `npm ci --ignore-scripts`
- `npm run lint`
- `npm run typecheck`
- `npm test -- --run` (513 vitest)
- `npm run build`
- `npm run build:mac` (working .app)
- `python3 -m unittest discover -s tests/unit -p 'test_*.py' -v` (81 tests including 15 new rule-prefixed tests)
- `python3 scripts/security_ci_guard.py` (post-quest workflow tree)

No per-job `--ignore-scripts` exemptions were needed; the lockfile only has `fsevents` install scripts (macOS-only optional) and the Mac build doesn't actually need them at build time.

## Code Review

Single reviewer (Claude). Verdict: clean.

> "All 4 phases match plan; 15 rule-prefixed tests + real-tree smoke present; workflows lock down id-token, npm cache, and --ignore-scripts as specified; 0 fix_now, 2 defer nits."

The two defer items: a harmless idempotent `strip_yaml_comments` redundancy in `is_local_npm_install`, and a pre-existing em-dash comment in `codex-ci-review.yml` that the builder did not modify (out of scope). Both deferred to `.quest/backlog/deferred_findings.jsonl`.

## Files Touched

Modified (8):
- `.github/workflows/ci.yml`
- `.github/workflows/codex-ci-review.yml`
- `.github/workflows/deploy-pages.yml`
- `.github/workflows/mac-pr-check.yml`
- `.github/workflows/release-mac.yml`
- `.github/workflows/security.yml`
- `scripts/security_ci_guard.py`
- `tests/unit/test_security_ci_guard_release.py`

New (4):
- `.github/codex-cli-version.txt`
- `.github/dependabot.yml`
- `.github/workflows/codex-version-drift.yml`
- `docs/security/2026-05-12-ci-supply-chain-review.md` (was preexisting untracked; preserved in commit)

Total: +483 / -34.

## Decisions

- **Solo mode** per user request, overriding the router's full-workflow recommendation. Justified by the maintainer's track record and the surgical nature of the changes.
- **Latest-always policy for `@openai/codex`** with `--ignore-scripts` added. The lifecycle-script attack path is closed; the residual risk (a compromised minor release executing JS at `codex exec` time) is accepted because codex's read-only sandbox bounds the blast radius.
- **No SHA pinning for `actions/*`.** Tag pinning + Dependabot is the documented policy. SHA pinning trades real maintenance overhead against threats SHA pinning doesn't actually address (GitHub platform compromise).
- **No artifact SHA256 manifests for release-mac.yml.** The realistic build-side modification attack is closed by R3's `--ignore-scripts`. Manifests would only catch platform-level tampering between upload and download, which is out of our threat model.
- **Reopen vs new issue on drift:** if the maintainer manually closes the drift tracking issue without updating `.github/codex-cli-version.txt`, the next drift run opens a new issue rather than reopening the closed one. Reopening would override deliberate maintainer dismissal.

## Validation Gate Outcomes

All eight automated gates green first try. Manual maintainer Mac validation (`open .build/mac/Build/Products/Release/doc2md.app`) is the final gate before merge, deferred to the PR review step.

## Cross-Agent Conversation

Not invoked. Solo mode + the work is mechanical (workflow edits + guard predicates). No persona inflection point warranting Dexter's perspective in this quest.

## Bookkeeping

- Memoir: `docs/journal/038-celebrate-ci-supply-chain-hardening.md` (this is JC's celebration entry; PR-less so routed via last-celebration-was-Dexter fallback).
- Diary: `docs/diary/2026-05-12.md`.
- Quest journal: this file.
- All three README indexes updated.
