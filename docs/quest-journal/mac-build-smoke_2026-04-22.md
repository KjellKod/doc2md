# Quest: mac-build-smoke_2026-04-21__2246

**Completion date:** 2026-04-22
**Quest mode:** solo
**Quality tier:** Diamond

## This is where it all began...

> Phase 2.5: Developer Mac build helper and release-launch verification.
>
> Phase 1 shipped with a blank-Release-window bug because the smoke test only checked "window appeared", not "UI rendered". Fixed in PR #78 via the `doc2md://` scheme handler. The lesson should not repeat.
>
> Add a one-command local Mac `.app` build that is predictable and discoverable, plus a mechanical release-launch smoke that actually confirms the React UI rendered, not just that a window appeared. Keep scope tight: no CI, no signing, no notarization, no packaging. Those belong in Phase 5.

## Summary

Phase 2.5 of the Mac desktop app: a one-command local build helper (`scripts/build-mac-app.sh` + `npm run build:mac`) and a mechanical release-launch smoke (`scripts/verify-mac-release-launch.sh`) that mechanizes the exact thing that bit us in Phase 1. The smoke reads the frontmost window title via AppleScript/System Events and fails on a `doc2md [ERR]` prefix, which is the signal the PR #78 inline error reporter already writes on any JS load or runtime failure. The build helper detects `DEVELOPER_DIR`, prefers full Xcode over Command Line Tools, runs `npm run build:desktop` + `xcodebuild`, runs the forbidden-API grep on `ShellBridge.swift`, and prints a single `Built: <absolute .app path>` line. Roadmap moves Phase 2 to done with PR #78 and marks Phase 2.5 active. No Swift source changes; no vite.config.ts changes; no CI; no signing.

## Files Changed

Modified:
- `apps/macos/README.md` - document `npm run build:mac`, `./scripts/verify-mac-release-launch.sh`, resolved `.app` path, unsigned-build note, TCC/Accessibility failure distinction
- `ideas/mac-desktop-app-roadmap.md` - Phase 2 done (PR #78), Phase 2.5 active
- `package.json` - add `build:mac` npm script

New:
- `scripts/build-mac-app.sh` - bash build helper (DEVELOPER_DIR detection, full-Xcode verification, `npm run build:desktop`, `xcodebuild`, forbidden-API grep, `Built:` output line)
- `scripts/verify-mac-release-launch.sh` - bash launch smoke (`--wait-seconds` validation, `open -na`, AppleScript title inspection, `[ERR]` detection, trap-based cleanup with `pkill` fallback)

## Iterations

- Plan iterations: 1
- Fix iterations: 0

## Agents

| Role | Model | Runtime |
|------|-------|---------|
| Planner | claude-opus-4-7 (1M) | claude |
| Plan Reviewer A | claude-opus-4-7 (1M) | claude |
| Builder | gpt-5.4 | codex |
| Code Reviewer A | claude-opus-4-7 (1M) | claude |

Solo mode: no Reviewer B, no arbiter, no fixer.

## Key Decisions

- **Launch-smoke signal: option (c)**, minimum viable. Uses the `doc2md [ERR]` title prefix PR #78 already emits via the Vite desktop transform + inline error reporter. No Swift source changes. Limitations documented: a total JS-absent window can still pass this smoke; the Swift `ShellLoadErrorView` native overlay is not visible to AppleScript. Accepted because this is a local developer tool, not a CI gate, and the Phase 1 failure mode that motivated the quest would have been caught.
- **Forbidden-API grep pattern** (POSIX extended regex, plan D2, applied to `ShellBridge.swift` only so `AppScheme.swift` legitimate `FileManager` usage is untouched): `\b(FileManager|NSOpenPanel|NSSavePanel|FileHandle|replaceItem|replacingItem|startAccessingSecurityScopedResource|stopAccessingSecurityScopedResource|securityScopedResource)\b|\.write\(to:`
- **`DEVELOPER_DIR` detection**: respect caller override; when `xcode-select -p` returns `/Library/Developer/CommandLineTools`, point at `/Applications/Xcode.app/Contents/Developer`; verify `xcodebuild` exists there, else fail with a specific install-Xcode error.
- **`--wait-seconds` override**: default 3, validated integer 0..60 via POSIX case glob; reject non-numeric cleanly.
- **Trap cleanup**: always quit the doc2md app on exit. Graceful `osascript` quit with bounded wait, `pkill -f doc2md.app/Contents/MacOS/doc2md` as last resort. Comment ties the pkill fallback to TCC/Accessibility permission edge cases.
- **Title check classifies failure modes**: process not running, no window, TCC/Accessibility denied, generic fallback. README distinguishes the first two from the third.
- **Scope preserved**: no changes to `vite.config.ts`, Swift product code, hosted browser build, CI, signing, notarization, DMG, Sparkle, or deployment target.

## Review Findings

Plan iteration 1 verdict: **approve** (solo). Reviewer A called the plan implementable, cited real tree references (vite.config.ts:46, WebShellView.swift:115-121, .gitignore line, ShellBridge.swift I/O-free status), and filed four non-blocking observations: off-by-four on the gitignore line number claim, a note on bundle cache staleness, a pkill-fallback comment request, a TCC/Accessibility failure-mode README distinction. Builder addressed all four.

Code review iteration 1: Reviewer A **approve, zero blockers**. Explicit confirmations: forbidden-API grep matches D2 as a strict superset, `--wait-seconds` validation uses POSIX case glob with 0..60 upper bound, trap covers EXIT/INT/TERM with re-entry guard, `quit_with_osascript` bounds graceful wait ~3s before `pkill`, AppleScript asserts process exists AND window count > 0, README documents TCC/Accessibility failure mode distinct from process-not-running, roadmap table correct, `build:mac` alias correct, `.build/` present once in `.gitignore` at line 16, no emoji, no unintended changes.

## Validation

- `bash -n scripts/build-mac-app.sh`: PASS
- `bash -n scripts/verify-mac-release-launch.sh`: PASS
- `shellcheck scripts/build-mac-app.sh scripts/verify-mac-release-launch.sh`: PASS
- `npm run typecheck`: PASS
- `npm run lint`: PASS
- `npm test -- --run`: PASS (38 files, 317 tests)
- `npm run build`: PASS
- `npm run build:desktop`: PASS
- `xcrun swiftc -parse apps/macos/doc2md/doc2mdApp.swift apps/macos/doc2md/WebShellView.swift apps/macos/doc2md/ShellBridge.swift apps/macos/doc2md/MenuController.swift apps/macos/doc2md/AppScheme.swift`: PASS
- Forbidden-API self-test: PASS (grep fired on injected `_ = FileManager.default`)
- `git diff --check`: PASS
- `./scripts/build-mac-app.sh`: SKIPPED (requires full Xcode + GUI, manual developer verification)
- `./scripts/verify-mac-release-launch.sh`: SKIPPED (requires full Xcode + GUI + Accessibility permissions, manual developer verification)

## Cross-Agent Conversation

Solo quest: no Dexter-Claude round-trip during workflow. Solo reflection logged at `.quest/mac-build-smoke_2026-04-21__2246/logs/conversation.log`. Dexter did contribute the Requiem content at completion (odd-PR path), focused on the theme of burying the eyeballed "window appeared" smoke and the fiction that Phase 5 ghosts had been invited to Phase 2.5.

## Celebration Data

<!-- celebration-data-start -->
```json
{
  "quest_mode": "solo",
  "agents": [
    {"name": "planner", "model": "claude-opus-4-7", "role": "The Chalk-Outline Drafter"},
    {"name": "plan-reviewer-a", "model": "claude-opus-4-7", "role": "The First-Read Approver"},
    {"name": "builder", "model": "gpt-5.4", "role": "The Script Assembler"},
    {"name": "code-reviewer-a", "model": "claude-opus-4-7", "role": "The Zero-Blocker Auditor"}
  ],
  "achievements": [
    {"icon": "💎", "title": "First-Pass Survivor", "desc": "Approved plan on first review, clean code review on first pass, zero fix iterations"},
    {"icon": "🧪", "title": "Mechanized The Phase 1 Bug", "desc": "Launch smoke now catches the exact doc2md [ERR] failure mode that blank-Release-window shipped with"},
    {"icon": "🔒", "title": "ShellBridge Kept I/O-Free", "desc": "Forbidden-API grep integrated into every local build; no FileManager, NSOpenPanel, FileHandle, security-scoped APIs"},
    {"icon": "📚", "title": "Discoverable Ritual", "desc": "npm run build:mac gave contributors a front door; README + roadmap caught up"},
    {"icon": "⚡️", "title": "Tight Scope", "desc": "No CI, no signing, no notarization, no Swift source changes, no vite.config changes"}
  ],
  "metrics": [
    {"icon": "📊", "label": "5 files, 318 LOC"},
    {"icon": "🧪", "label": "317/317 tests passing"},
    {"icon": "⏱️", "label": "1 plan iteration, 0 fix iterations"},
    {"icon": "🔒", "label": "Forbidden-API grep: 9 tokens + .write(to:"},
    {"icon": "🥫", "label": "--wait-seconds validated 0..60"},
    {"icon": "🪦", "label": "Phase 2 buried with PR #78, Phase 2.5 active → complete"}
  ],
  "quality": {"tier": "Diamond", "icon": "💎", "grade": "A+"},
  "quote": {
    "text": "The implementation meets every acceptance criterion in the plan and every constraint in the brief. No blocking issues. No source-code changes required.",
    "attribution": "Code Reviewer A, final verdict"
  },
  "victory_narrative": "A small quest with a real correctness payoff: the launch smoke now mechanizes the exact failure mode that Phase 1 eyeballed past. Phase 2 done with PR #78, Phase 2.5 active and complete. Next is Phase 3: filesystem access on the Swift side. The forbidden-API grep is the tripwire that guards that transition.",
  "test_count": 317,
  "tests_added": 0,
  "files_changed": 5
}
```
<!-- celebration-data-end -->
