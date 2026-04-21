# Quest: mac-shell-scaffold_2026-04-20__2231

**Completion date:** 2026-04-21
**Quest mode:** workflow
**Quality tier:** Gold

## Summary

Added the Phase 1 Mac-only shell for `doc2md.app`: a minimal SwiftUI + `WKWebView` wrapper, a desktop Vite build mode with relative asset paths, a Release resource-copy build phase, Debug dev-server loading, and local Mac validation docs. The hosted browser build remains on `/doc2md/`, and persistence, bridge commands, Sparkle, signing, and notarization stay deferred.

## Files Changed

- `.gitignore` - ignore generated Mac web resources while keeping `.gitkeep`
- `.quest-manifest` - list existing Claude memory files as user-customized entries
- `package.json` - add `build:desktop`
- `vite.config.ts` - use `base: "./"` only for desktop mode
- `apps/macos/README.md` - document local Debug, desktop bundle, and Release-style workflows
- `apps/macos/doc2md.xcodeproj/project.pbxproj` - add the app target, build phases, and resource script
- `apps/macos/doc2md.xcodeproj/xcshareddata/xcschemes/doc2md.xcscheme` - share the `doc2md` scheme
- `apps/macos/doc2md/Resources/Web/.gitkeep` - keep the resource folder present
- `apps/macos/doc2md/WebShellView.swift` - add the `WKWebView` shell and Debug error overlay
- `apps/macos/doc2md/doc2mdApp.swift` - add the SwiftUI app entry point

## Iterations

- Plan iterations: 2
- Fix iterations: 1

## Agents

| Role | Model | Runtime |
|------|-------|---------|
| Planner | Codex fallback | codex |
| Plan Reviewer A | gpt-5.4-mini | codex |
| Plan Reviewer B | gpt-5.4-mini | codex |
| Arbiter | gpt-5.4-mini | codex |
| Builder | Codex | codex |
| Code Reviewer A | gpt-5.4-mini | codex |
| Code Reviewer B | gpt-5.4-mini | codex |
| Fixer | Codex | codex |

## Key Decisions

- Debug skips the desktop bundle script and loads `http://localhost:5173`.
- Release-style builds run `npm run build:desktop` before Copy Bundle Resources.
- Generated `Resources/Web` output is ignored; the Xcode script preserves `.gitkeep`.
- Xcode validation uses `DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer` when the active `xcode-select` path is Command Line Tools.
- Existing `.claude/projects/.../memory/*.md` files are listed as `[user-customized]` manifest entries.

## Review Findings

- Initial code review found no scaffold implementation blockers.
- Both reviewers flagged the manifest validation failure for three existing Claude memory files.
- Fix iteration 1 added those files to `.quest-manifest`; re-review passed cleanly.

## Validation

- `plutil -lint apps/macos/doc2md.xcodeproj/project.pbxproj` passed.
- `xcrun swiftc -parse apps/macos/doc2md/doc2mdApp.swift apps/macos/doc2md/WebShellView.swift` passed.
- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed and emitted `/doc2md/assets/...`.
- `npm run build:desktop` passed and emitted `./assets/...`.
- `npm test -- --run` passed: 31 test files, 271 tests.
- `DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer xcodebuild -list -project apps/macos/doc2md.xcodeproj` passed.
- Debug and Release `xcodebuild` builds passed.
- Release and Debug app launch smoke checks passed.
- `bash scripts/validate-manifest.sh` passed after the fix loop.

## Celebration Data

<!-- celebration-data-start -->
```json
{
  "quest_mode": "workflow",
  "agents": [
    {"name": "planner", "model": "codex", "role": "The Recovery Planner"},
    {"name": "plan-reviewer-a", "model": "gpt-5.4-mini", "role": "The Xcode Environment Critic"},
    {"name": "plan-reviewer-b", "model": "gpt-5.4-mini", "role": "The Operational Gap Spotter"},
    {"name": "arbiter", "model": "gpt-5.4-mini", "role": "The PATH Coroner"},
    {"name": "builder", "model": "codex", "role": "The Shell Builder"},
    {"name": "code-reviewer-a", "model": "gpt-5.4-mini", "role": "The Manifest Examiner"},
    {"name": "code-reviewer-b", "model": "gpt-5.4-mini", "role": "The Second Examiner"},
    {"name": "fixer", "model": "codex", "role": "The Manifest Cleaner"}
  ],
  "achievements": [
    {"icon": "⭐", "title": "Native Shell First Breath", "desc": "A SwiftUI WKWebView app now carries the existing React UI"},
    {"icon": "⭐", "title": "Two-Base Build Discipline", "desc": "Hosted builds keep /doc2md/ while desktop builds use relative assets"},
    {"icon": "⭐", "title": "Debug Is Honest", "desc": "A missing Vite server gets a visible local-development error"},
    {"icon": "⭐", "title": "Release Proves The Bundle", "desc": "Xcode Release builds run the desktop web bundle before resources copy"},
    {"icon": "⭐", "title": "Manifest Debt Paid", "desc": "The repo manifest gate went red, then clean, in one focused fix pass"}
  ],
  "metrics": [
    {"icon": "📊", "label": "2 web asset bases validated: hosted and desktop"},
    {"icon": "🧪", "label": "271 Vitest assertions stayed green"},
    {"icon": "🔧", "label": "2 Xcode configurations built: Debug and Release"},
    {"icon": "📚", "label": "1 local Mac runbook added under apps/macos"},
    {"icon": "🔒", "label": "0 persistence or native bridge scope creep"}
  ],
  "quality": {"tier": "Gold", "icon": "🥇", "grade": "B"},
  "quote": {"text": "Manifest blocker resolved; validation now passes and no new blocker was introduced.", "attribution": "Code Reviewer B, final verdict"},
  "victory_narrative": "The quest started as a shell and stayed a shell. It added the native wrapper, proved the two web build paths, kept the browser deployment stable, and let the review gate catch an unrelated manifest debt before the PR did.",
  "test_count": 271,
  "tests_added": 0,
  "files_changed": 10
}
```
<!-- celebration-data-end -->
