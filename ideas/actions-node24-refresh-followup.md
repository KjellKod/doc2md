# Actions Node 24 Refresh Follow-up

## Status

Quest: `actions-node24-refresh_2026-03-30__1255`

Last recorded quest state:

- `phase`: `plan`
- `status`: `in_progress`
- `quest_mode`: `solo`
- `updated_at`: `2026-03-30T18:56:03Z`

The original quest addressed GitHub's Node.js 20 action-runtime deprecation warning. The quest artifacts say the first implementation used workflow-level `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24` as a bridge. The current workflow files have since moved most actions forward to newer major versions, so the old bridge approach no longer reflects the main repo state.

## Current Evidence

Most workflow actions are already on newer major versions:

- `actions/checkout@v5`
- `actions/setup-node@v6`
- `actions/github-script@v8`
- `actions/deploy-pages@v5`
- `actions/upload-artifact@v7` in most places

One remaining root CI usage still references `actions/upload-artifact@v4` for Playwright failure artifacts.

## What Should Be Done

1. Update the remaining `actions/upload-artifact@v4` usage in `.github/workflows/ci.yml` to the current repo-standard artifact action version.
2. Run `python3 scripts/security_ci_guard.py`.
3. Run or observe the next PR CI workflow and confirm the Node.js 20 action-runtime warning is gone.
4. Archive `actions-node24-refresh_2026-03-30__1255` after that verification.

## Why

This is not product-facing, but it is worth closing because CI warnings hide real signal. The remaining work is small and keeps the workflow surface consistent with the rest of the repo. It also lets the old quest be archived based on current evidence instead of stale state.

## Priority

Low. This is a cleanup and CI hygiene item, not a release blocker unless GitHub starts failing older action runtimes.
