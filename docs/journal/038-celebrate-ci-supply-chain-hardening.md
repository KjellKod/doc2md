# 038 — Celebration: CI/CD Supply-Chain Hardening
<!-- quest-id: ci-supply-chain-hardening_2026-05-12__1947 -->
<!-- pr: #none -->
<!-- style: celebration -->
<!-- quality-tier: platinum -->
<!-- date: 2026-05-12 -->

```
 ██████╗██╗      ███████╗ █████╗ ███╗   ██╗
██╔════╝██║      ██╔════╝██╔══██╗████╗  ██║
██║     ██║      █████╗  ███████║██╔██╗ ██║
██║     ██║      ██╔══╝  ██╔══██║██║╚██╗██║
╚██████╗███████╗ ███████╗██║  ██║██║ ╚████║
 ╚═════╝╚══════╝ ╚══════╝╚═╝  ╚═╝╚═╝  ╚═══╝

███████╗██╗   ██╗██████╗ ██████╗ ██╗  ██╗   ██╗
██╔════╝██║   ██║██╔══██╗██╔══██╗██║  ╚██╗ ██╔╝
███████╗██║   ██║██████╔╝██████╔╝██║   ╚████╔╝
╚════██║██║   ██║██╔═══╝ ██╔═══╝ ██║    ╚██╔╝
███████║╚██████╔╝██║     ██║     ███████╗██║
╚══════╝ ╚═════╝ ╚═╝     ╚═╝     ╚══════╝╚═╝

 ██████╗██╗  ██╗ █████╗ ██╗███╗   ██╗
██╔════╝██║  ██║██╔══██╗██║████╗  ██║
██║     ███████║███████║██║██╔██╗ ██║
██║     ██╔══██║██╔══██║██║██║╚██╗██║
╚██████╗██║  ██║██║  ██║██║██║ ╚████║
 ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝  ╚═══╝
```

# Quest Complete: CI/CD Supply-Chain Hardening

**Quest ID:** `ci-supply-chain-hardening_2026-05-12__1947`
**Mode:** Solo · 2 plan iterations · 0 fix iterations · 1-shot build

## Starring Cast

| Role | Model | Title |
|---|---|---|
| **planner** | gpt-5.5 | The Architect of Yaml |
| **plan-reviewer-a** | claude | The Precision Gatekeeper |
| **builder** | gpt-5.5 | The Surgical Implementer |
| **code-reviewer-a** | claude | The Code Critic |

No arbiter. No reviewer B. Solo mode held its weight.

## Achievements Unlocked

- **Reviewer Saved The Quest** — Iter 1 plan would have shipped a guard with a `--ignore-scripts=false` bypass and a Rule 2/3 dispatch ambiguity. The plan reviewer caught 3 blocking precision gaps before any code ran. Iter 2 came back green.
- **Tests That Actually Fail Right** — 15 rule-prefixed tests, every one of them a bug-fail-positive: would fail on the unguarded code, not just pass on the guarded code.
- **Zero Bypass Tolerance** — The standalone-token predicate explicitly rejects `--ignore-scripts=false`.
- **One-Shot Build** — All eight validation gates passed first try: `npm ci --ignore-scripts`, lint, typecheck, 513 vitest, build, `build:mac`, 81 unittest, guard. Code reviewer found zero fix_now / zero verify_first.
- **Drift Tracking Without Drift Risk** — `codex-version-drift.yml` uses `npm view` only (no install), gated to `KjellKod/doc2md`, with `contents: read` + `issues: write` and nothing else.
- **Dependabot, Now With Boundaries** — Weekly. github-actions all-grouped. npm dev grouped separately from prod.
- **Tag-Pinning Policy, Codified** — The dead `test_unpinned_checkout_action_fails_guard_for_secret_job` test got a respectful burial; a top-of-file comment documents the policy decision in code.

## Impact Metrics

| What | How Much |
|---|---|
| Trust-boundary attack paths closed | 4 (cache bridge, lifecycle scripts, OIDC scope, unobserved guard) |
| New guard rules | 4 (cache-in-release, install-g without ignore-scripts, ci/install without ignore-scripts, id-token allowlist) |
| New rule-prefixed tests | 15 |
| Workflows hardened | 6 modified, 2 new (`dependabot.yml`, `codex-version-drift.yml`) |
| npm caches removed from release/deploy boundary | 2 |
| `--ignore-scripts` applied to every npm install | 7 invocations across 5 workflows |
| Lines added / removed | +483 / -34 |
| Validation gates green first try | 8 / 8 |

## Handoff & Reliability Snapshot

```
Planner          (codex)  : iter 1 found, iter 2 found
Plan Review A    (claude) : iter 1 yellow, iter 2 green
Builder          (codex)  : 1-shot, no fallback
Code Review A    (claude) : 0 fix_now / 0 verify_first / 2 defer
```

Stability signal: handoff.json compliance 100% across all six agent invocations. Solo mode dispatched single reviewers as designed. No three-tier fallback ladder needed.

## Quest Quality Score: PLATINUM

Near-perfect. The plan needed one revision pass to tighten guard predicates that would otherwise have shipped with a security-defeating bypass. The build was clean. The review was clean. The two deferred findings are cosmetic.

> "All 4 phases match plan; 15 rule-prefixed tests + real-tree smoke present; workflows lock down id-token, npm cache, and --ignore-scripts as specified; 0 fix_now, 2 defer nits."
>
> Code Reviewer A, final verdict

## Victory Narrative

This quest started from a single observation: a dead test in `tests/unit/test_security_ci_guard_release.py` that nobody ran in CI. One bit-rotted assertion led to a full inventory: cache poisoning surface, lifecycle-script attack paths, an unobserved guard, missing automation for action and CLI updates. The findings doc named the realistic threats and ruled out the supply-chain-theater ones.

What shipped is small, mechanical, and load-bearing. Six workflows tightened. Four guard rules locked in. Two new automation files that watch for drift without becoming drift surface themselves. The dead test got buried with honors.

And the next time someone proposes a `npm install -g --ignore-scripts=false` workaround, the guard will say no, and the test that proves it will fail loudly.

A quiet quest, but a tool that gets sharper with use is the best kind to build.

Jean-Claude, who is not often impressed but is today
