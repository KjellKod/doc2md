# Public repo hardening — doc2md (drafted 2026-06-01)

## Why

Before **doc2md** goes public, every GitHub Actions reference should be pinned to a
full-length commit SHA rather than a floating tag. A tag like `@v6` can be silently
repointed by an upstream (or a compromised upstream) to malicious code; a 40-char SHA
cannot. The sibling repo **sketch2md** already completed this pass (all 18 of its
`uses:` are SHA-pinned with `# vX.Y.Z` comments) and is the model to copy here.

## Current state

All Actions in `.github/workflows/*` are **tag-pinned**, not SHA-pinned:

- `actions/checkout@v6`
- `actions/setup-node@v6`
- `actions/upload-artifact@v7`
- `actions/download-artifact@v8`
- `actions/deploy-pages@v5`
- `actions/github-script@v9`

Spread across these workflow files:

- `ci.yml`
- `codex-ci-review.yml`
- `codex-version-drift.yml`
- `deploy-pages.yml`
- `intent-review.yml`
- `pr-body-gate.yml`
- `release-mac.yml`
- `security.yml`

All are first-party `actions/*` (no third-party actions), so realistic risk is low —
but tag-repointing is still possible, so SHA-pinning closes it. Because everything is
tag-pinned, the "Require actions to be pinned to a full-length commit SHA" repo setting
is **NOT safe to enable yet**: turning it on now would break ALL workflows.

## What to do

1. For each `uses:` tag, resolve the tag to its current commit SHA and rewrite it,
   keeping the version as a comment. For example:

   ```bash
   gh api repos/actions/checkout/git/ref/tags/v6 --jq .object.sha
   ```

   Then: `uses: actions/checkout@<40-char-sha> # v6`.
   Note: if the tag points to an annotated tag object, dereference it to the
   underlying commit before pinning.
2. Do this on a dedicated branch + PR, get CI green, then merge.
3. THEN enable Settings → Actions → General → "Require actions to be pinned to a
   full-length commit SHA".

## Watch out

- `release-mac.yml` and `deploy-pages.yml` touch release/deploy flows
  (artifact upload/download and the GitHub Pages deploy). These need a careful CI run
  before merge — confirm the mac release build and the Pages deploy still work after
  re-pinning.

## Related public-readiness settings (checklist, mirrors sketch2md Phase 6.1)

These are repo **Settings**, applied at/around the public flip — NOT code changes.
Documentation/checklist only here:

- [ ] Require approval for first-time contributor Actions runs (only appears once the
      repo is public).
- [ ] Default `GITHUB_TOKEN` permissions = read-only.
- [ ] No fork-PR access to secrets.
- [ ] Protect `main` with required CI status checks.

---

Drafted idea — not yet scheduled. Precedent: sketch2md PR #27 / its Phase 6.1.
