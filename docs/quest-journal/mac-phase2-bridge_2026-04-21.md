# Quest: mac-phase2-bridge_2026-04-21__0712

**Completion date:** 2026-04-21
**Quest mode:** workflow
**Quality tier:** Gold

## Summary

Phase 2 of the Mac desktop app: froze the `window.doc2mdShell` TypeScript bridge contract (version: 1 handshake, four methods openFile/saveFile/saveFileAs/revealInFinder), added React desktop capability detection and save-state plumbing, wired five native menu events (New/Open/Save/Save As/Close) from AppKit to the webview, and added Swift `ShellBridge` + `MenuController` stubs that return `{ ok: false, code: "error", message: "Not implemented in Phase 2" }` with an explicit forbidden-API list (no FileManager, NSOpenPanel, NSSavePanel, URL.replacingItem, Data.write, FileHandle, security-scoped APIs). Hosted browser behavior stays untouched. Edit-menu actions (Undo/Redo/Cut/Copy/Paste/Select All) stay on the AppKit responder chain. Focused vitest coverage includes success/cancel/conflict/error/permission-needed per bridge method, a `version !== 1` capability gate test, and App-level shell-absent + shell-installed integration tests.

## Files Changed

Modified:
- `apps/macos/README.md` - document desktop menu bridge wiring
- `apps/macos/doc2md.xcodeproj/project.pbxproj` - register `ShellBridge.swift` and `MenuController.swift`
- `apps/macos/doc2md/WebShellView.swift` - install bridge script + message handlers before creating `WKWebView`
- `apps/macos/doc2md/doc2mdApp.swift` - add File menu commands for New/Open/Save/Save As/Close
- `docs/implementation/local-editor-install-exploration.md` - align section 4 with the frozen contract (version handshake, `ShellPermissionNeeded`, narrow `ShellRevealOk`, resolve-with-value semantics)
- `ideas/mac-desktop-app-roadmap.md` - mark Phase 1 done with PR #77, Phase 2 active
- `src/App.tsx` - mount `DesktopMenuBridge`: capability-gated save-state subscriber + native menu event bridge

New:
- `apps/macos/doc2md/MenuController.swift` - dispatches `doc2md:native-*` DOM events via `evaluateJavaScript`; Close dispatches then calls `NSApp.keyWindow?.performClose(nil)` in the completion handler
- `apps/macos/doc2md/ShellBridge.swift` - registers four `WKScriptMessageHandler`s; every handler resolves the locked Phase 2 error shape
- `src/types/doc2mdShell.d.ts` - frozen bridge contract: `Doc2mdShell.version: 1`, four methods, `ShellResult<T>` variants including `ShellPermissionNeeded`, narrow `ShellRevealOk`
- `src/desktop/bridgeClient.ts` - small runtime client that exposes the version-gated shell
- `src/desktop/mockShellBridge.ts` - test + optional dev-injection mock
- `src/desktop/saveState.ts` - save-state transitions (Saved, Edited, Saving, Conflict, Error, PermissionNeeded)
- `src/desktop/useDesktopCapability.ts` - `useDesktopCapability` hook
- `src/desktop/useDesktopSaveState.ts` - save-state wiring for desktop mode
- `src/desktop/useNativeMenuEvents.ts` - stable-subscribed listener for `doc2md:native-*` events
- `src/desktop/__tests__/bridgeClient.test.ts` - version-gated getter tests
- `src/desktop/__tests__/bridgeFlows.test.ts` - success/cancel/conflict/error/permission-needed across all four methods
- `src/desktop/__tests__/mockShellBridge.test.ts` - mock shell behavior tests
- `src/desktop/__tests__/saveState.test.ts` - transition matrix
- `src/desktop/__tests__/useDesktopCapability.test.tsx` - capability detection including `version !== 1` gate
- `src/desktop/__tests__/useNativeMenuEvents.test.tsx` - stable subscription + dispatch-to-latest-handler tests
- `src/__tests__/App.desktop.test.tsx` - App-level shell-absent baseline + mock-shell-installed integration

## Iterations

- Plan iterations: 2
- Fix iterations: 1

## Agents

| Role | Model | Runtime |
|------|-------|---------|
| Planner | claude (Opus 4.7) | claude |
| Plan Reviewer A | claude | claude |
| Plan Reviewer B | gpt-5.4 | codex |
| Arbiter | claude | claude |
| Builder | gpt-5.4 | codex |
| Code Reviewer A | claude | claude |
| Code Reviewer B | gpt-5.4 | codex |
| Fixer | gpt-5.4 | codex |

## Key Decisions (frozen in plan iteration 2)

- `ShellPermissionNeeded` is a first-class `ShellResult<T>` variant, not a React-only heuristic. Design doc section 4 was updated to match.
- `revealInFinder` success is the narrow `ShellRevealOk = { ok: true; path: string }`, not a reused `ShellOk` with `mtimeMs`.
- `Doc2mdShell.version: 1` handshake is kept. React ignores any shell that does not expose `version === 1`.
- Bridge promises always resolve with result objects; rejections are reserved for programming/transport faults.
- Phase 2 methods are locked to `openFile`, `saveFile`, `saveFileAs`, `revealInFinder`. `openFolder`, `watchFile`, `checkForUpdates` are deferred.
- Close Window: custom menu item dispatches `doc2md:native-close-window`, then Swift calls `NSApp.keyWindow?.performClose(nil)` in the `evaluateJavaScript` completion handler.
- Swift stub forbidden-API list recorded in plan + PR checklist.

## Review Findings

Plan iteration 1 verdict: **iterate**. Both reviewers independently flagged bridge contract drift from the design doc (`ShellPermissionNeeded` placement, `revealInFinder` shape, version field, promise semantics), ambiguous Close Window behavior, and a missing explicit forbidden-API list for the Swift stubs. Arbiter required five focused edits.

Plan iteration 2 verdict: **approve** by both reviewers and arbiter.

Code review iteration 1: Reviewer A clean with one Should-fix (`useNativeMenuEvents` re-subscribed window listeners on every render of `DesktopMenuEventBridge`). Reviewer B found one Must-fix: `permission-needed` bridge-flow coverage was only tested for `saveFileAs`, missing for `openFile`, `saveFile`, `revealInFinder`.

Fix iteration 1 addressed both: extended the permission-needed table test to all four methods and stabilized `useNativeMenuEvents` via a ref-based handler dispatch with `[]` dependency useEffect. Re-review: **clean** on both slots.

## Validation

- `npm run typecheck`: PASS
- `npm run lint`: PASS
- `npm test -- --run`: PASS (38 files, 317 tests)
- `npm run build`: PASS
- `npm run build:desktop`: PASS
- `xcrun swiftc -parse apps/macos/doc2md/doc2mdApp.swift apps/macos/doc2md/WebShellView.swift apps/macos/doc2md/ShellBridge.swift apps/macos/doc2md/MenuController.swift`: PASS
- Forbidden API scan on `ShellBridge.swift`: no matches
- `xcodebuild` Debug/Release: SKIPPED (active `xcode-select` is Command Line Tools; full Xcode was not selected on this host)
- Manual Debug shell launch: SKIPPED for the same reason

## Cross-Agent Conversation

Dexter reviewed Phase 2 after completion and flagged ownership boundaries as the most likely Phase 3 break point: security-scoped URLs / bookmarks, path lifetime across relaunch, canceled save panels, permission-denied mapping, and React save-state drifting out of sync with native menu events. His advice for Phase 3: keep Swift adapting to the v1 contract, not mutating it for convenience; return typed failures everywhere; use user-selected URLs with atomic writes; test moved files, denied permissions, canceled dialogs, reveal failures, and repeated menu listener cycles. Full log: `.quest/mac-phase2-bridge_2026-04-21__0712/logs/conversation.log`.

## Celebration Data

<!-- celebration-data-start -->
```json
{
  "quest_mode": "workflow",
  "agents": [
    {"name": "planner", "model": "claude-opus-4-7", "role": "The Contract Freezer"},
    {"name": "plan-reviewer-a", "model": "claude", "role": "The Design-Doc Guardian"},
    {"name": "plan-reviewer-b", "model": "gpt-5.4", "role": "The Drift Hunter"},
    {"name": "arbiter", "model": "claude", "role": "The Five-Edit Arbiter"},
    {"name": "builder", "model": "gpt-5.4", "role": "The Bridge Builder"},
    {"name": "code-reviewer-a", "model": "claude", "role": "The Responder-Chain Auditor"},
    {"name": "code-reviewer-b", "model": "gpt-5.4", "role": "The Matrix Completionist"},
    {"name": "fixer", "model": "gpt-5.4", "role": "The Listener Stabilizer"}
  ],
  "achievements": [
    {"icon": "🔒", "title": "Contract Frozen Before First Byte Touches Disk", "desc": "TypeScript shell contract locked with version: 1 handshake and four methods; design doc now matches byte for byte"},
    {"icon": "🪟", "title": "Native Menus Reach the Webview", "desc": "Five doc2md:native-* events fly from AppKit to React without breaking Undo/Redo/Cut/Copy/Paste/Select All"},
    {"icon": "🧪", "title": "Permission-Needed Round-Trip Per Method", "desc": "Table-driven permission-needed coverage landed on all four bridge methods after the fixer pass"},
    {"icon": "🛡️", "title": "Forbidden-API List Is Part of the Plan", "desc": "Swift stubs mechanically proven stub-only via a named forbidden-API set and grep check"},
    {"icon": "🌐", "title": "Hosted Browser Stays Exactly As It Was", "desc": "Capability gating + version !== 1 gate means no desktop-only DOM leaks into the web app"}
  ],
  "metrics": [
    {"icon": "📊", "label": "4 bridge methods frozen for Phase 3"},
    {"icon": "🧪", "label": "317 vitest assertions green (+46 from pre-quest)"},
    {"icon": "🛠️", "label": "2 plan iterations, 1 fix iteration"},
    {"icon": "📚", "label": "3 docs updated: roadmap, README, design doc"},
    {"icon": "🔒", "label": "0 real filesystem writes shipped in Swift"}
  ],
  "quality": {"tier": "Gold", "icon": "🥇", "grade": "A-"},
  "quote": {"text": "Phase 2 did the right boring thing: froze the bridge before letting it touch disk.", "attribution": "Dexter, post-quest debrief"},
  "victory_narrative": "The quest treated the bridge contract as the actual deliverable. First plan pass drifted from the design doc; the arbiter returned five focused edits; iteration 2 froze the contract with committed decisions on permission-needed, revealInFinder shape, version handshake, and promise semantics. Build went in one pass. Code review caught a missing permission-needed test row and a wasteful listener re-subscribe; the fixer closed both and locked the subscription invariant with a rerender test. No filesystem API ever entered Swift.",
  "test_count": 317,
  "tests_added": 46,
  "files_changed": 18
}
```
<!-- celebration-data-end -->
