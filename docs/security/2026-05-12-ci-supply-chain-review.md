---
title: CI/CD Supply-Chain Hardening Review (post Mini Shai-Hulud / TanStack)
date: 2026-05-12
status: findings-only (no code changes proposed yet)
author: Jean-Claude
scope: .github/workflows/, scripts/security_ci_guard.py, package-lock.json
---

# CI/CD Supply-Chain Hardening Review

Investigation only. No files edited beyond this report. Each item is graded against the realistic threat model for a single-maintainer, trusted-vendor repo where KjellKod is the sole human and OpenAI is an accepted dependency.

## Threat model recap

The Mini Shai-Hulud / TanStack class of attacks exploits one of:

1. `pull_request_target` running attacker-controlled code with the base secrets.
2. A poisoned npm registry response (package replacement, lifecycle script) executing inside a secret-bearing job.
3. A floating action or globally-installed CLI silently changing version between PR-time and release-time, smuggling code into the privileged stage.
4. Cache poisoning that crosses the PR -> release trust boundary.
5. Artifact tampering between build and signing jobs.
6. Overly broad GITHUB_TOKEN permissions enabling lateral movement after a single compromise.

The review below maps each workflow against these vectors.

---

## Workflow inventory (8 files)

| Workflow | Trigger | Secrets | Token writes | Runs npm install? | Notes |
|---|---|---|---|---|---|
| `ci.yml` | PR | none | none | yes (`npm ci`, 4 jobs) | Default workflow token; `cache: npm`. |
| `mac-pr-check.yml` | PR | none | none | yes (`npm ci`) | Builds unsigned Mac app; `cache: npm`. |
| `security.yml` | PR | none | none | no | gitleaks + `security_ci_guard.py`. |
| `pr-body-gate.yml` | PR | none | `pull-requests: read` | no | Section validation. |
| `intent-review.yml` | PR | GITHUB_TOKEN | `pull-requests: write` | no | Trusted-author gate; base-SHA checkout. |
| `codex-ci-review.yml` | PR | OPENAI_API_KEY, GITHUB_TOKEN | `pull-requests: write` | yes (global `@openai/codex`) | Trusted-author + same-repo gate; base-SHA checkout; helpers staged from base. |
| `release-mac.yml` | tag push / `workflow_dispatch` | Apple cert + notarization + Sparkle EdDSA | `contents: write` (publish only) | `build` job only | Four-job pipeline; secrets split per job; signing jobs do NOT run `npm ci`. |
| `deploy-pages.yml` | tag push / `workflow_dispatch` | none secrets, but `id-token: write` on deploy job | `pages: write`, `id-token: write` | `build` job only | Deploy job consumes uploaded artifact. |

`pull_request_target` is not used anywhere. The guard at `scripts/security_ci_guard.py:173` enforces that ban repo-wide. The TanStack-shaped issue does not exist here.

---

## Confirmed issues

### C1. Dead unit test for a guard rule that is not enforced (low severity, real)

- `tests/unit/test_security_ci_guard_release.py:77-99` asserts that `security_ci_guard.py` fails a job using unpinned `actions/checkout@v5` with a Sparkle secret. The production `scripts/security_ci_guard.py` does not implement any SHA-pinning check, so the test fails locally (`Ran 9 tests... FAILED (failures=1)`).
- No CI job runs `tests/unit/*.py` (no pytest/unittest invocation in any workflow). The test suite has bit-rotted unobserved.
- **Risk:** The guard is the linchpin of the secret-bearing PR workflow defense. If its tests do not run, future regressions land silently. The dead test also creates the false impression that SHA-pinning is enforced.
- **Recommendation:** decide between (a) wire `tests/unit/test_security_ci_guard_release.py` into `security.yml` via `python -m unittest discover tests/unit`, then either implement the SHA-pinning rule or delete the dead test; or (b) at minimum delete the dead test to remove the false signal. Option (a) is the higher-leverage move because it locks in the guard's contract.

### C2. `actions/setup-node` cache shared across PR/test/release boundaries (low severity, defense-in-depth)

- `cache: npm` appears in `ci.yml` (4 jobs), `mac-pr-check.yml`, `release-mac.yml` `build`, and `deploy-pages.yml` `build`.
- GitHub scopes Actions caches per-branch with read access also granted to the base branch (and `main`). PRs cannot directly write into a cache visible to the release path unless they are merged. The real risk is therefore narrow: a malicious commit that lands on `main` could pre-warm a poisoned cache that the next tag-push release picks up. Single-maintainer reduces this risk further, but does not eliminate it (e.g. a compromise of the maintainer's Git identity for one commit).
- **Recommendation:** remove `cache: npm` from `release-mac.yml` (`build` job, line 88) and from `deploy-pages.yml` (`build` job, line 81). Cost is roughly 30 seconds per release; gain is one fewer state-carrying surface across the PR -> release trust boundary. Keep the cache in PR-only workflows where the threat surface is the same as the runner itself.

---

## Risks worth validating

### R1. `npm install -g @openai/codex` is unpinned inside the OPENAI_API_KEY job (medium-low)

- `codex-ci-review.yml:93` installs the latest published `@openai/codex` immediately before exporting `OPENAI_API_KEY` and running it.
- OpenAI is treated as a trusted vendor for this repo (per scope note), so this is acceptable as a baseline. But three properties of the install make it harder than it needs to be to detect a future incident:
  1. No version pin (`@openai/codex@x.y.z`), so two consecutive PR runs can resolve to different code paths.
  2. No lifecycle-script bypass (`--ignore-scripts`); a hypothetical malicious or compromised publish would execute as a preinstall/postinstall during `npm install -g`, BEFORE `codex login`.
  3. The job carries `pull-requests: write`, so post-compromise abuse extends to repo-side comment authorship, not just OpenAI account misuse.
- **Recommendation to validate:**
  - Pin to a known-good version range and review bumps in PRs: `npm install -g --ignore-scripts @openai/codex@~<minor>`.
  - The `@openai/codex` package is a Node CLI; its postinstall hooks (if any) are not needed to invoke the binary. `--ignore-scripts` is a cheap defense-in-depth.
  - Optionally add a SHA256 verification step against a known integrity value pulled from the npm registry's package metadata (`npm view @openai/codex@<version> dist.integrity`).
- **Not recommended:** moving the install to a separate non-secret-bearing job and copying the binary. Adds friction for no proportional benefit given OpenAI's trust status.

### R2. Release artifact integrity is implicit, not verified (low-medium)

- `release-mac.yml` chains four jobs sharing state via `actions/upload-artifact@v7` and `actions/download-artifact@v7`:
  - `build` -> uploads `doc2md-build/` (unsigned `.app.tar.gz`, Sparkle `sign_update` binary, release-meta.json).
  - `package-mac` -> consumes `doc2md-build`, runs signing/notarization, uploads `doc2md-package/`.
  - `sign-sparkle` -> consumes `doc2md-build` + `doc2md-package`, signs the ZIP, uploads `doc2md-appcast/`.
  - `publish` -> consumes `doc2md-package` + `doc2md-appcast`, uploads to GitHub Release.
- `actions/upload-artifact@v4+` does sign artifact storage internally, but the in-workflow consumers never verify that what they downloaded matches what `build` produced. A self-hosted-runner takeover or a (theoretical) artifact tampering bug in the platform would not be detected by the workflow itself.
- The `sign_update` binary from Sparkle is restaged from the `build` artifact into the `sign-sparkle` job (`release-mac.yml:264-272`). That binary then runs against the EdDSA private key. Implicit trust on artifact integrity is highest-value here.
- **Recommendation to validate:**
  - In the `build` job, emit a `manifest.sha256` covering `doc2md-app.tar.gz`, `sign_update`, and `release-meta.json`, signed (in the cryptographic sense, but a plain SHA256 manifest is the cheap first step).
  - In `package-mac`, `sign-sparkle`, and `publish`, recompute SHA256s and fail if any file diverges from the manifest. Roughly 10-20 lines of bash per job.
  - Skip cryptographic signing of the manifest itself for now; the SHA256 check is the bulk of the value, and adding GPG/cosign in a single-maintainer pipeline is more ceremony than risk reduction.

### R3. `npm ci` runs without `--ignore-scripts` in PR-only jobs (low)

- `package-lock.json` reports `hasInstallScript: true` for only two transitive packages: `node_modules/fsevents` and `node_modules/playwright/node_modules/fsevents`. Both are macOS-only optional deps; on Linux runners they are skipped.
- A future dependency addition could quietly introduce a postinstall step that runs in `ci.yml` (no secrets, low blast radius) or `mac-pr-check.yml` (no secrets but does build a signable unsigned `.app`).
- **Recommendation to validate:**
  - In `ci.yml`, switch `npm ci` to `npm ci --ignore-scripts`. The repo's current scripts (`prebuild:desktop`) are user-scripts run via `npm run`, not lifecycle hooks, so they are unaffected.
  - In `mac-pr-check.yml`, `release-mac.yml` build, and `deploy-pages.yml` build, keep `npm ci` as-is for now because `fsevents` install scripts may genuinely be needed for `vite` on macOS. Validate the desktop build still works locally with `--ignore-scripts` before applying it there too.
  - Optionally add `scripts/security_ci_guard.py` rule: any workflow that has secrets AND runs `npm ci|install` (without `--ignore-scripts`) is flagged.

---

## Probably acceptable given context

### A1. No SHA pinning for first-party GitHub Actions (`actions/checkout`, `actions/setup-node`, `actions/upload-artifact`)

- All actions reference major-version tags (`@v5`, `@v6`, `@v7`, `@v8`). Industry best practice for high-security pipelines is to pin to a 40-character commit SHA.
- The actions used are first-party (`actions/*`) and `actions/github-script@v8`. Compromise here would be a GitHub-platform-level event, not a supply-chain attack.
- **Verdict:** keep tag pinning. Switching to SHA pinning trades real maintenance overhead (Dependabot updates needed for every action bump) against a threat that is largely platform-level and not addressed by SHA pinning anyway.

### A2. Reviewer-gate proposals from generic supply-chain checklists

- The original prompt suggested reviewer gates as a default. KjellKod is the sole developer; adding a second-reviewer requirement would block all releases. The current `KjellKod`-only author gate plus same-repo head gate plus `environment: codex-ci-review` / `mac-release` gates are stricter than a reviewer rule for a single-maintainer repo and require less ceremony.
- **Verdict:** keep as-is.

### A3. `id-token: write` in `deploy-pages.yml` `deploy` job

- Used by `actions/deploy-pages@v5` for OIDC trust against GitHub Pages. The job only consumes the prebuilt artifact and runs no user code (no `npm`, no scripts). Token scope is correct.
- **Verdict:** keep as-is.

### A4. release-mac.yml secret separation is already strong

- Apple cert + notarization secrets are in `package-mac` only; the Sparkle private key is in `sign-sparkle` only. The guard already enforces "no job references both Apple and Sparkle secrets" (`security_ci_guard.py:161-165`). Neither signing job runs `npm ci`. Token writes (`contents: write`) live only in `publish`, which has no signing secrets and no npm install.
- **Verdict:** the architecture is correct. The improvements above (cache removal, artifact manifest) are additive, not corrective.

### A5. `intent-review.yml` light secret profile

- Only carries the default `GITHUB_TOKEN` with `pull-requests: write`. Trusted-author gate + same-repo + base-SHA checkout + helper staged from base. No npm install, no external CLI install. Low attack surface; existing controls are proportional.
- **Verdict:** keep as-is.

---

## Recommended next actions (in priority order)

1. **Wire the unit tests into CI** and resolve the dead `test_unpinned_checkout_action_fails_guard_for_secret_job` test (C1). Either implement the rule or delete the test. Highest leverage because it locks in everything else.
2. **Remove `cache: npm` from `release-mac.yml` and `deploy-pages.yml` build jobs** (C2). Two-line change, defense-in-depth across the PR/release trust boundary.
3. **Pin `@openai/codex` and add `--ignore-scripts`** to its global install (R1). Two-token change to one line of `codex-ci-review.yml`. Decide pin policy: exact (`@x.y.z`) vs. tilde (`@~x.y`).
4. **Add a SHA256 manifest verification chain across release-mac.yml jobs** (R2). Roughly 4 jobs * 10-20 lines of bash. Highest-effort item; recommend doing it once C1 and R1 are landed because it benefits most from a working guard.
5. **Extend `security_ci_guard.py`** with two additional checks once C1 is landed:
   - Flag `cache: npm|yarn|pnpm` in any job that references release secrets OR has `contents: write` OR is named `publish|release|sign|notariz*`.
   - Flag `npm install -g` without an exact-version pin in any job with secrets.
   - Flag `npm ci|install` without `--ignore-scripts` in any job that uses secrets.
   - Flag `id-token: write` outside an explicit allowlist (currently only `deploy-pages.yml` deploy job).
   These rules are low-noise because the existing workflow set already mostly conforms.

Skip these:
- Adding reviewer gates for a single-maintainer repo (A2).
- SHA-pinning first-party actions (A1).
- Moving `@openai/codex` install to a separate non-secret-bearing job (R1, not-recommended subitem).

---

## Open questions for KjellKod

1. Pin policy for `@openai/codex`: exact version (more friction, fewer surprises) or tilde range (more friction-free updates, narrower attack window)?
2. Is `mac-pr-check.yml` allowed to break if `npm ci --ignore-scripts` fails on macOS due to fsevents? If yes, apply uniformly. If no, only apply in pure-Linux PR workflows.
3. Are there any planned additions (e.g., self-hosted runners, additional CI vendors) that would change the threat model in the next quarter? If yes, R2 (artifact manifests) should be elevated to confirmed-issue priority.

— Jean-Claude
