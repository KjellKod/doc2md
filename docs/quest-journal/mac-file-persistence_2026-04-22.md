# Quest: mac-file-persistence_2026-04-22__2017

**Completion date:** 2026-04-22
**Quest mode:** workflow
**Quality tier:** Gold

## This is where it all began...

> Mac Phase 3 - Markdown File Persistence
>
> Replace Phase 2's Swift bridge stubs with real filesystem behavior so the doc2md Mac app can open, save, save-as, and reveal markdown files, with conflict detection and correct line-ending preservation. Phase 3 turns the `window.doc2mdShell` contract from a frozen interface into a working product.

## Summary

Phase 3 replaced the stubbed Mac bridge with real file persistence. The Swift side now opens Markdown/text files through `NSOpenPanel`, detects LF vs CRLF from a 4 KB sniff, tracks content modification time, saves atomically through a sibling temp file and `FileManager.replaceItemAt`, handles Save As, reveals files in Finder, and maps cancellation, conflicts, permissions, and generic failures into typed shell results.

The React desktop shell now consumes the real bridge results: visible toolbar/app-ready state, save-state pill, conflict bar with Reload/Overwrite/Cancel, permission prompts, and transient error notices. The release smoke was strengthened from "WKWebView didFinish fired" to "React toolbar rendered and emitted `app ready: true`."

## Files Changed

Modified:
- `apps/macos/README.md` - documents real file persistence behavior, validation, and launch-smoke signal expectations
- `apps/macos/doc2md.xcodeproj/project.pbxproj` - adds the native test target and `FileStore.swift`
- `apps/macos/doc2md.xcodeproj/xcshareddata/xcschemes/doc2md.xcscheme` - makes `doc2mdTests` runnable from the shared scheme
- `apps/macos/doc2md/MenuController.swift` - wires native menu events including reveal
- `apps/macos/doc2md/ShellBridge.swift` - implements open/save/save-as/reveal handlers and exact extension panel filtering
- `apps/macos/doc2md/WebShellView.swift` - probes rendered UI readiness and logs `app ready: true`
- `apps/macos/doc2md/doc2mdApp.swift` - wires bridge/menu controller lifecycle
- `scripts/build-mac-app.sh` - turns forbidden native APIs into a positive allowlist with named justifications
- `scripts/verify-mac-release-launch.sh` - requires the rendered app-ready log token
- `src/App.tsx` - adds desktop status/error region, toolbar readiness marker, conflict/permission UX, and save-state wiring
- `src/__tests__/App.desktop.test.tsx` - covers desktop UI save/conflict/error behavior
- `src/desktop/__tests__/bridgeFlows.test.ts` - covers bridge result handling flows
- `src/desktop/__tests__/mockShellBridge.test.ts` - updates mock contract coverage
- `src/desktop/__tests__/useNativeMenuEvents.test.tsx` - covers native menu event handling
- `src/desktop/mockShellBridge.ts` - models the real shell contract for tests/dev
- `src/desktop/useDesktopSaveState.ts` - consumes real open/save/save-as/reveal outcomes
- `src/desktop/useNativeMenuEvents.ts` - handles native menu commands
- `src/hooks/useFileConversion.helpers.ts` - supports desktop document state integration
- `src/hooks/useFileConversion.ts` - threads desktop file state through conversion behavior
- `src/styles/global.css` - styles status bar, save-state pill, notices, and conflict UI
- `src/types/doc2mdShell.d.ts` - extends the authoritative v1 desktop shell contract
- `src/types/index.ts` - exports updated desktop types

New:
- `apps/macos/doc2md/FileStore.swift` - isolated filesystem operations, line-ending preservation, atomic writes, permission mapping, and mtime rounding
- `apps/macos/doc2mdTests/FileStoreTests.swift` - native fixture tests for open/save/conflict/permission/cancel behavior
- `src/desktop/__tests__/macBuildAllowlist.test.ts` - verifies the native API allowlist is positive and non-vacuous

## Iterations

- Plan iterations: 3
- Fix iterations: 2

## Agents

| Role | Runtime | Notes |
|------|---------|-------|
| Planner | Codex | Produced three plan passes; final pass covered native XCTest wiring explicitly. |
| Plan Reviewer A | Codex | Blocked early plans until native validation and non-vacuous test wiring were concrete. |
| Plan Reviewer B | Codex | Independently caught the same validation risks. |
| Arbiter | Codex | Approved iteration 3 after the native XCTest execution blocker was resolved. |
| Builder | Codex | Implemented Mac filesystem persistence, desktop UX, native tests, smoke changes, and allowlist policy. |
| Code Reviewer A | Codex | Final re-review passed after exact panel extension filtering was fixed. |
| Code Reviewer B | Codex | Final re-review passed after exact panel extension filtering was fixed. |
| Fixer | Codex | Ran two fix passes; the second switched panels to exact extension filtering. |

Claude bridge was unavailable, so this was a Codex-only workflow with structured handoffs.

## Key Decisions

- **No persisted bookmarks in Phase 3:** security-scoped access is started and stopped for current-session selected URLs; reopen-after-relaunch remains Phase 4 recent-files scope.
- **Last-opened folder is in-memory only:** Save As can use the last selected folder in the current run, with no UserDefaults persistence.
- **Error visibility lives in the desktop shell:** one visible status/toast region handles open/save/save-as/reveal errors, conflicts, and permission prompts.
- **Save uses an in-flight guard:** React state prevents duplicate Cmd-S races without adding a separate debounce layer.
- **Exact panel filtering uses `allowedFileTypes`:** deprecated but intentionally used because `allowedContentTypes` widens `.txt` into broader `public.plain-text` behavior. The deprecation warning is accepted and documented by review.
- **Launch smoke uses rendered UI readiness:** `load succeeded` is now only a precondition; `app ready: true` is the pass condition.
- **Forbidden API test became positive allowlist:** native filesystem/panel/reveal APIs are legitimate in Phase 3 only with named justifications.

## Review Findings

Plan review took three iterations. The arbiter approved only after the plan explicitly covered native reveal reachability, native allowlist scope, mandatory native validation, and non-vacuous `doc2mdTests` scheme/test wiring.

Code review found one material issue after the first fix pass: using `allowedContentTypes`/UTType matching for `.txt` could allow broader plain-text files than the brief requested. Fix iteration 2 switched the panels to exact extension filtering and both reviewers returned `next: null`.

## Validation

- `npm test -- --run`: PASS (39 files, 331 tests)
- `npm run typecheck`: PASS
- `npm run lint`: PASS
- `bash -n scripts/build-mac-app.sh scripts/verify-mac-release-launch.sh`: PASS
- Focused post-fix Vitest: `npm test -- --run src/desktop/__tests__/macBuildAllowlist.test.ts src/__tests__/App.desktop.test.tsx`: PASS (2 files, 17 tests)
- Swift typecheck: PASS, with intentional `allowedFileTypes` deprecation warnings for exact extension filtering
- Native XCTest: `xcodebuild test ... -only-testing:doc2mdTests/FileStoreTests`: PASS (7 tests)
- Debug `xcodebuild`: PASS
- Release `xcodebuild`: PASS
- Launch smoke: PASS after user approved stopping a stale running `/Users/kjell/Downloads/doc2md.app/Contents/MacOS/doc2md` process

## Cross-Agent Conversation

Claude bridge setup was unavailable, so completion used a solo Codex/Dexter reflection rather than a JC-Dexter round trip. The conversation log records the main watch points: native filesystem semantics, non-vacuous XCTest wiring, and rendered app-ready smoke token drift.

## Celebration Data

<!-- celebration-data-start -->
```json
{
  "quest_mode": "workflow",
  "agents": [
    {"name": "planner", "model": "gpt-5.4", "role": "The Native Validation Drafter"},
    {"name": "plan-reviewer-a", "model": "gpt-5.4", "role": "The XCTest Gate Critic"},
    {"name": "plan-reviewer-b", "model": "gpt-5.4", "role": "The Independent Plan Critic"},
    {"name": "arbiter", "model": "gpt-5.4", "role": "The Non-Vacuous Scheme Judge"},
    {"name": "builder", "model": "gpt-5.4", "role": "The File Bridge Installer"},
    {"name": "code-reviewer-a", "model": "gpt-5.4", "role": "The Extension Filter Coroner"},
    {"name": "code-reviewer-b", "model": "gpt-5.4", "role": "The Second Extension Witness"},
    {"name": "fixer", "model": "gpt-5.4", "role": "The Panel Filter Repair"}
  ],
  "achievements": [
    {"icon": "🔒", "title": "Stub Funeral", "desc": "Replaced Phase 2 bridge stubs with real scoped open/save/save-as/reveal behavior"},
    {"icon": "📝", "title": "Line Endings Preserved", "desc": "Open detects LF/CRLF and save re-encodes with the requested ending"},
    {"icon": "⚔️", "title": "Conflict Witness", "desc": "Expected mtime mismatches now surface a Reload / Overwrite / Cancel conflict bar"},
    {"icon": "🧪", "title": "Native Tests Became Real", "desc": "doc2mdTests runs FileStore fixtures for open, save, conflict, permission, and cancel flows"},
    {"icon": "📡", "title": "Rendered Smoke Signal", "desc": "Release smoke now waits for app ready: true instead of trusting didFinish alone"},
    {"icon": "🚪", "title": "Exact Panel Gate", "desc": "Panel filtering was tightened to md, markdown, and txt extensions after review caught UTType widening"}
  ],
  "metrics": [
    {"icon": "📊", "label": "25 implementation files changed before closeout"},
    {"icon": "🧪", "label": "331 Vitest tests passing"},
    {"icon": "🧬", "label": "7 native FileStore XCTest cases passing"},
    {"icon": "🏗️", "label": "Debug and Release xcodebuild succeeded"},
    {"icon": "🚦", "label": "Launch smoke passed on rendered app-ready signal"},
    {"icon": "📋", "label": "21/21 handoffs read from handoff.json"}
  ],
  "quality": {"tier": "Gold", "icon": "🥇", "grade": "B"},
  "quote": {
    "text": "Fix iteration 2 resolves the panel filtering issue with no new blockers found.",
    "attribution": "Code Reviewer B, final verdict"
  },
  "victory_narrative": "Phase 3 turned the Mac shell bridge from a promise into a product surface. The rough edges were useful: plan review forced native tests to be real, and code review caught the subtle UTType widening before it shipped.",
  "test_count": 338,
  "tests_added": 21,
  "files_changed": 25
}
```
<!-- celebration-data-end -->
