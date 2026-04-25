# Mac Phase 5a: Mac PR CI Check

- Quest ID: `mac-pr-ci-check_2026-04-24__1319`
- Completed: 2026-04-24
- Mode: solo
- Branch: `roadmap/phase5-split-and-ui-refresh`

## This is where it all began...

From the quest brief:

> Add a GitHub Actions workflow that runs on every pull request against this repo and fails if the Mac side is broken. No secrets. No signing. No notarization. No Sparkle. No release automation. Just a fast, no-cost regression gate.

Phase 5a was intentionally scoped to CI coverage only. Release automation, signing, notarization, DMG generation, appcasts, Sparkle, and secret-bearing workflows remain deferred to later roadmap phases.

## Outcome

Added `.github/workflows/mac-pr-check.yml`, a `pull_request` workflow for `main` that runs on `macos-latest` with top-level `permissions: contents: read`. It installs dependencies with Node 22, runs `npm run build:desktop`, makes the Mac build helper executable on the runner checkout, runs `bash scripts/build-mac-app.sh --configuration Release`, and uploads the unsigned `.app` artifact on success.

The workflow avoids `pull_request_target`, `workflow_dispatch`, secrets, environments, signing, notarization, Sparkle, and release-tag behavior. Third-party actions are pinned by full 40-character SHA with inline tag comments.

Added one sentence to `apps/macos/README.md` so contributors know that PRs against `main` run the Mac Release build through the new workflow.

## Numbers

- **Files changed:** `.github/workflows/mac-pr-check.yml`, `apps/macos/README.md`
- **Plan iterations:** 1
- **Fix iterations:** 0
- **Review mode:** solo
- **Handoff.json compliance:** 4/4 observed invocations

## Validation

Builder and reviewer validation covered:

- `bash scripts/validate-manifest.sh`
- `actionlint .github/workflows/mac-pr-check.yml`
- YAML parsing for the workflow
- `npm run build:desktop`
- no `secrets.*` references
- no `pull_request_target`, `workflow_dispatch`, `environment:`, `id-token`, `contents: write`, `pull-requests`, or `issues`
- exactly one permissions block with `contents: read`
- all `uses:` lines pinned to 40-character SHAs
- public tag SHA verification for:
  - `actions/checkout` `v5.0.1`
  - `actions/setup-node` `v6.4.0`
  - `actions/upload-artifact` `v7.0.1`

Not run locally: the full `bash scripts/build-mac-app.sh --configuration Release` path and PR-only negative validation commits. Those require the GitHub macOS runner or deliberate throwaway PR commits and are part of the follow-up PR validation path.

## Files to remember

- `.github/workflows/mac-pr-check.yml` — new Mac PR regression gate
- `apps/macos/README.md` — contributor note pointing to the workflow

## Celebration Data

<!-- celebration-data-start -->
```json
{
  "quest_mode": "solo",
  "agents": [
    {"name": "Jean-Claude", "model": "claude", "role": "Planner and Plan Reviewer A"},
    {"name": "Dexter", "model": "gpt-5.4", "role": "Builder, Code Reviewer A, Orchestrator"}
  ],
  "achievements": [
    {"icon": "🔒", "title": "No-secret PR gate", "desc": "pull_request only, contents: read, no id-token, no environments, no secrets"},
    {"icon": "📌", "title": "Pinned action surface", "desc": "checkout, setup-node, and upload-artifact use verified 40-character SHAs"},
    {"icon": "🧪", "title": "Mac-specific failure path", "desc": "desktop bundle build, forbidden API scan, and xcodebuild now run before merge"},
    {"icon": "📚", "title": "Contributor breadcrumb", "desc": "Mac README points directly to the new workflow"}
  ],
  "metrics": [
    {"icon": "⚡️", "label": "1 plan iteration, 0 fix iterations"},
    {"icon": "✅", "label": "4/4 handoff.json compliance"},
    {"icon": "🔍", "label": "actionlint, YAML parse, desktop build, secrets, permissions, trigger, and SHA checks passed"}
  ],
  "quality": {"tier": "Diamond", "icon": "💎", "grade": "A+"},
  "quote": {
    "text": "Reviewer A found no blocking issues; manifest, actionlint, desktop build, security, and SHA-pinning checks passed.",
    "attribution": "Code Reviewer A"
  },
  "victory_narrative": "Phase 5a added a narrow, no-secret macOS PR gate that catches Swift build breaks, desktop bundle breaks, and forbidden native file API regressions before merge, without pulling release automation into scope.",
  "test_count": 0,
  "tests_added": 0,
  "files_changed": 2
}
```
<!-- celebration-data-end -->
