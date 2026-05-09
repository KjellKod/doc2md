# Actions Node 24 Refresh Follow-up

## Status

Completed on the current branch. The remaining `actions/upload-artifact@v4` usage in `.github/workflows/ci.yml` was updated to the repo-standard artifact action version, and the stale root quest directory was moved under `.quest/archive/`.

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

The root CI Playwright artifact upload now uses the same current artifact action major as the rest of the repo.

## What Should Be Done

Run or observe the next PR CI workflow and confirm the Node.js 20 action-runtime warning is gone.

## Why

This is not product-facing, but it was worth closing because CI warnings hide real signal. The cleanup keeps the workflow surface consistent with the rest of the repo.

## Priority

Closed as a cleanup and CI hygiene item.
