# Quest Brief: Mac Phase 5a — Mac PR CI Check

Copy the block below (between the fences) into `/quest` to start the run. The brief was written to be pasted verbatim; do not edit it unless you are changing scope.

```
Quest brief: Mac Phase 5a — Mac PR CI Check

Context

- PR #81 is merged and completed Phase 4. Phases 1-4 of the Mac roadmap are done.
- Roadmap: ideas/mac-desktop-app-roadmap.md (Phase 5a section)
- Phase 5 is intentionally split into 5a/5b/5c. This quest is 5a only.
- Today the repo has zero CI coverage for Mac-specific code. A Swift regression or a broken desktop web bundle will only surface when someone runs `npm run build:mac` locally. Fix that first, before introducing any signing or release automation.

Goal

Add a GitHub Actions workflow that runs on every pull request against this repo and fails if the Mac side is broken. No secrets. No signing. No notarization. No Sparkle. No release automation. Just a fast, no-cost regression gate.

Required scope

1. Add a new workflow file, proposed path `.github/workflows/mac-pr-check.yml`:
   - Trigger: `pull_request` on the default branch. Never `pull_request_target`.
   - Runner: `macos-latest`.
   - Permissions: `contents: read` only (no writes, no id-token).
   - Steps in order:
     a. `actions/checkout` pinned by full SHA.
     b. `actions/setup-node` pinned by full SHA, Node version matching the repo's `.nvmrc` or package.json engines (whichever exists).
     c. `npm ci` from repo root.
     d. `npm run build:desktop` to prove the desktop web bundle compiles.
     e. `bash scripts/build-mac-app.sh --configuration Release` to run the helper (which already performs the forbidden-API allowlist scan AND runs xcodebuild, and handles DEVELOPER_DIR fallback for the GitHub runner).
     f. Optional but recommended: `actions/upload-artifact` (SHA-pinned) to publish the resulting unsigned `.build/mac/Build/Products/Release/doc2md.app` as a workflow artifact for reviewers who want to smoke-test on their own macOS host.
2. Keep concurrency sensible: if the same PR re-pushes, cancel the in-flight run (`concurrency` group per-PR with `cancel-in-progress: true`).
3. No third-party action may be referenced by tag (`@v1`, `@main`). Every action must be pinned by full SHA (repo CI-trustworthiness convention). Add an inline comment next to each pinned SHA with the human-readable tag for future audit.
4. Confirm the scripts the workflow calls are already executable on a clean checkout (the GitHub runner performs a fresh clone). If `scripts/build-mac-app.sh` needs `chmod +x`, handle that in the workflow step rather than mutating repo permissions.
5. Update `apps/macos/README.md` to reference the new CI check briefly (one sentence + a link pattern like `.github/workflows/mac-pr-check.yml`), so contributors know the check exists.

Acceptance criteria

- On a branch that intentionally breaks the Xcode build (e.g. introduce a Swift syntax error), the new workflow fails and posts a visible failing status to the PR.
- On a branch that intentionally adds a forbidden native file API (e.g. `FileHandle(forWritingTo:)` in a Swift source file under `apps/macos/doc2md/`), the allowlist scan inside `scripts/build-mac-app.sh` fails and the workflow fails.
- On a branch that breaks `npm run build:desktop` (e.g. introduce a TypeScript error that `build:desktop` catches), the workflow fails.
- On a clean branch (current `main` as of this quest), the workflow passes.
- The workflow never requests or references any secret. `grep -r "secrets\." .github/workflows/mac-pr-check.yml` returns nothing.
- Every third-party action in the workflow is pinned by full 40-char SHA.
- The workflow file has `permissions: contents: read` at the top level and does not widen anywhere.

Validation

- Run `bash scripts/build-mac-app.sh --configuration Release` locally on the quest branch to confirm the helper still works end-to-end.
- Push the quest branch and open a draft PR. Confirm the new check runs on `macos-latest` and passes.
- On the same draft PR, temporarily add a Swift syntax error in a throwaway commit (e.g. a stray `;;`). Push. Confirm the check fails with a readable error pointing at the Swift source. Revert before merge.
- On the same draft PR, temporarily add a forbidden API call (e.g. `FileHandle(forWritingTo: URL(fileURLWithPath: "/tmp/x"))`) to a Swift file under `apps/macos/doc2md/`. Push. Confirm the allowlist scan fails with a named pattern match. Revert before merge.
- Confirm `grep -r "secrets\." .github/workflows/mac-pr-check.yml` returns no matches.
- Confirm every `uses: ` line in the workflow is pinned by SHA, not tag.

Constraints

- No Sparkle, no DMG, no signing, no notarization, no appcast, no release-tagged workflow. Those are Phase 5b and 5c.
- Do not add secrets, environments, or `workflow_dispatch` triggers in this phase.
- Do not change `scripts/build-mac-app.sh` semantics unless strictly needed to make it runnable in CI. If a change IS needed, keep it minimal and document it in the quest's builder feedback discussion.
- Do not add any `pull_request_target` trigger. Never.
- Do not touch the hosted browser build pipeline or any existing non-Mac workflow.
- If the workflow's `macos-latest` runner image lacks Xcode at the expected path and `build-mac-app.sh` cannot resolve `DEVELOPER_DIR`, document the remediation in the quest brief response (e.g., an explicit `xcode-select -s` step or a `DEVELOPER_DIR` env var set on the step). Do not silently skip the Xcode build.
```

## When to run this

Run this quest after Phase 4 (#81) is merged. It has no dependency on Phase 5b or 5c and does not block Phase 6 (Editor & UI Refresh).

## Where this came from

Extracted from `ideas/mac-desktop-app-roadmap.md` §"Phase 5a: Mac PR CI Check".
