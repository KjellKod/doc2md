# Cloudflare Workers Deployment Plan

Status: Planned
Owner: KjellKod <kjell@candidtalentedge.com>
Date: 2026-06-08
Related: `.github/workflows/deploy-pages.yml`, `vite.config.ts`, `docs/implementation/mac-private-license-issuer-spec.md`

## Purpose

Move the hosted doc2md web app from GitHub Pages to Cloudflare Workers Static
Assets while preserving the current release-tag deployment discipline and the
public/private boundary for this repository.

This plan mirrors the security posture used by `sketch2md` without copying its
Next/OpenNext-specific adapter. doc2md is a Vite static app, so Cloudflare
deployment should use Workers Static Assets, not `@opennextjs/cloudflare`.

## Public Repo Safety Boundary

This repository may document:

- generic GitHub environment names;
- generic secret names such as `CLOUDFLARE_API_TOKEN` and
  `CLOUDFLARE_ACCOUNT_ID`;
- non-secret workflow behavior;
- public hostname decisions such as `https://doc2md.dev`;
- validation commands and release gates.

This repository must not contain:

- Cloudflare account IDs, zone IDs, token IDs, API token values, or dashboard
  screenshots that expose account metadata;
- exact token permission screenshots or bypass procedures;
- private license issuer code, webhook URLs, merchant credentials, signing keys,
  database details, customer records, or operational support data;
- production runtime secrets or sample secrets that resemble real credentials.

If a future doc needs account-specific setup notes, keep them outside this
public repo.

## Current State

doc2md currently deploys the hosted app to GitHub Pages through
`.github/workflows/deploy-pages.yml`.

The current hosted Vite base is `/doc2md/`, which matches GitHub Pages. A
Cloudflare custom domain deployment needs a root base path (`/`) for the hosted
build while keeping the desktop build at `./`.

## Step 1 - Manual Cloudflare Preparation

Do this in the Cloudflare dashboard and GitHub settings. Do not commit values
from this step.

- [ ] Confirm the intended public hostname, expected default:
  `https://doc2md.dev`.
- [ ] Create a narrowly scoped Cloudflare API token for deploying the doc2md
  Worker. Store the token value only as a GitHub environment secret.
- [ ] Record the Cloudflare account ID only in the GitHub environment secret.
  Do not commit the value.
- [ ] Create two GitHub environments:
  `cloudflare-workers-production` and `cloudflare-workers-preview`.
- [ ] Add `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as environment
  secrets in both environments.
- [ ] Keep production deploys tag-only. If GitHub environment protection is
  available for the repo plan, restrict production deployment to semver tags and
  require maintainer approval.

## Step 2 - Deploy-Prep PR

One PR should land all in-repo Cloudflare deployment changes. It must not deploy
or add private runtime infrastructure.

- [ ] Add an exact-pinned `wrangler` dev dependency.
- [ ] Add `wrangler.jsonc` for Workers Static Assets:

```jsonc
{
  "name": "doc2md",
  "compatibility_date": "2026-06-08",
  "assets": {
    "directory": "./dist",
    "not_found_handling": "single-page-application"
  }
}
```

- [ ] Add a Cloudflare hosted build mode that emits root-relative assets:
  `vite build --mode cloudflare`.
- [ ] Keep the desktop build base as `./`.
- [ ] Keep the GitHub Pages build base as `/doc2md/` until GitHub Pages is
  intentionally retired.
- [ ] Make the Cloudflare build produce the same public install artifacts as
  Pages: the hosted app, `doc2md-core-latest.tgz`, `latest-tarball.json`, and
  `doc2md-skill.skill`.
- [ ] Add package scripts:

```json
{
  "build:cf": "vite build --mode cloudflare",
  "preview:cf": "wrangler dev",
  "deploy:cf": "wrangler deploy"
}
```

- [ ] Add `.github/workflows/workers-preview.yml`.
- [ ] Add `.github/workflows/workers-production.yml`.
- [ ] Extend `scripts/security_ci_guard.py` and unit coverage if the new
  workflows create new secret-bearing patterns.
- [ ] Run local validation:

```bash
npm ci --ignore-scripts
npm run lint
npm run typecheck
npm test -- --run
npm run build
npm run build:cf
python3 scripts/security_ci_guard.py
```

Do not add runtime bindings, KV namespaces, D1, R2, Durable Objects, merchant
secrets, license issuer routes, checkout links, or API secrets in this PR.

## Step 3 - Preview Workflow Shape

The preview workflow should mimic sketch2md's trust split:

- [ ] Trigger on non-draft pull requests against `main`.
- [ ] Only run preview uploads for same-repo PRs from the trusted maintainer
  account.
- [ ] Build PR head code on a runner with no Cloudflare credentials.
- [ ] Upload `dist/` as a short-retention artifact.
- [ ] Start a fresh runner for the token-bearing upload job.
- [ ] Checkout the trusted base ref for `wrangler.jsonc` and the pinned
  Wrangler version.
- [ ] Install Wrangler globally with `npm install -g --ignore-scripts`.
- [ ] Upload a preview version with `wrangler versions upload` and a
  PR-specific preview alias.
- [ ] Comment the preview URL or explicit skip reason on the PR.

Important: if doc2md later gains runtime bindings or secrets in
`wrangler.jsonc`, preview upload must target an isolated preview Worker with no
production secrets, or previews must be disabled. A PR preview must never run
PR-authored code with production license, merchant, issuer, database, or signing
authority.

## Step 4 - Production Workflow Shape

The production workflow should deploy only from bare semver tags, matching the
current doc2md tag convention.

- [ ] Trigger on `push.tags: ["[0-9]*.[0-9]*.[0-9]*"]`.
- [ ] Enforce exact bare semver in the workflow with
  `^[0-9]+\.[0-9]+\.[0-9]+$`.
- [ ] Verify the tag commit is reachable from `main`.
- [ ] Run the full quality gate without Cloudflare credentials:

```bash
npm ci --ignore-scripts
npm run lint
npm run typecheck
npm test -- --run
npm run build
npm run build:cf
npm run test:e2e
```

- [ ] Upload the built `dist/` artifact with one-day retention.
- [ ] Deploy from a fresh runner in the `cloudflare-workers-production`
  environment.
- [ ] Install trusted pinned Wrangler with `npm install -g --ignore-scripts`.
- [ ] Verify the downloaded artifact before deployment.
- [ ] Run `wrangler deploy`.
- [ ] Create a GitHub release if one does not already exist for the tag.

The token-bearing deploy job must not run `npm ci`, `vite build`, tests, or
project build scripts.

## Step 5 - First Deploy

- [ ] Merge the deploy-prep PR to `main`.
- [ ] Confirm the GitHub environments have the required secrets.
- [ ] Push the first release tag intended for Cloudflare deployment.
- [ ] Confirm the production workflow creates or updates the `doc2md` Worker.
- [ ] Confirm the generated release exists on GitHub.

## Step 6 - Custom Domain

Do this in the Cloudflare dashboard after the Worker exists.

- [ ] Attach `doc2md.dev` as a Worker custom domain.
- [ ] Prefer a Worker custom domain over a route unless there is a specific
  reason to manage DNS and TLS separately.
- [ ] Wait for the certificate to become active.
- [ ] Verify `https://doc2md.dev` serves the app over HTTPS.
- [ ] If the public hostname differs from `doc2md.dev`, update canonical
  metadata, README links, app links, tests, and any license/support docs that
  reference the hosted web app.

## Step 7 - Retire GitHub Pages

Do this only after Cloudflare production is verified.

- [ ] Update README's live-app link from GitHub Pages to the Cloudflare
  hostname.
- [ ] Decide whether to keep GitHub Pages as temporary fallback or remove
  `.github/workflows/deploy-pages.yml`.
- [ ] If keeping both temporarily, document which URL is canonical.
- [ ] If removing Pages, update tests and scripts that assume `/doc2md/` as the
  hosted production base path.

## Done When

- [ ] `https://doc2md.dev` serves the hosted web app.
- [ ] The app can load, convert supported local documents, and download/copy
  output from the Cloudflare URL.
- [ ] The Install & Use assets are available from the Cloudflare URL.
- [ ] A bare semver tag deploys to Cloudflare and creates a GitHub release.
- [ ] PR previews produce a preview URL or a clear public-safe skip reason.
- [ ] No private issuer, merchant, account, customer, or secret material is
  committed.
- [ ] `python3 scripts/security_ci_guard.py` passes.

## References

- Cloudflare Workers Static Assets:
  https://developers.cloudflare.com/workers/static-assets/
- Cloudflare SPA routing with `not_found_handling`:
  https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/
- Wrangler configuration:
  https://developers.cloudflare.com/workers/wrangler/configuration/
