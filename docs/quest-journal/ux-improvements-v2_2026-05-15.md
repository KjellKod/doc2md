# Quest Journal: UX Improvements v2

- Quest ID: `ux-improvements-v2_2026-05-14__2154`
- Slug: `ux-improvements-v2`
- Completed: 2026-05-15
- Mode: workflow
- Quality: Tin
- Worktree: `.worktrees/quest/ux-improvements-v2`

## What Shipped

UX Improvements v2 closed the first-run desktop workspace gap:

- Implemented Mac session restore from `ideas/doc2md-mac-session-restore.md`.
- Split session restore state into `~/Library/Application Support/doc2md/session.json`.
- Kept restore eligibility Markdown-only and native-owned.
- Replaced hand-written recent file persistence with `NSDocumentController` as the source surfaced through the existing bridge contract.
- Added Open, New, and the theme toggle to compact working mode.
- Restyled the compact New button to match expanded-mode button chrome.
- Increased default preview height and improved mobile layout so the preview starts usable.
- Fixed the final active working-mode recent-menu clipping regression.

## Files Changed

- `apps/macos/doc2md.xcodeproj/project.pbxproj`
- `apps/macos/doc2md/PersistenceStore.swift`
- `apps/macos/doc2md/SessionStore.swift`
- `apps/macos/doc2md/ShellBridge.swift`
- `apps/macos/doc2mdTests/PersistenceStoreTests.swift`
- `apps/macos/doc2mdTests/SessionStoreTests.swift`
- `src/App.tsx`
- `src/__tests__/App.desktop.test.tsx`
- `src/components/WorkingModeBar.test.tsx`
- `src/components/WorkingModeBar.tsx`
- `src/desktop/DesktopApp.tsx`
- `src/desktop/__tests__/bridgeFlows.test.ts`
- `src/desktop/__tests__/mockShellBridge.test.ts`
- `src/desktop/bridgeClient.ts`
- `src/desktop/mockShellBridge.ts`
- `src/styles/global.css`
- `src/types/doc2mdShell.d.ts`

## Iterations

- Plan iterations: 2
- Fix iterations: 3

## Validation

Builder validation:

- `npm test -- src/components/WorkingModeBar.test.tsx`
- `npm test -- src/desktop`
- `npm test -- src/__tests__/App.desktop.test.tsx`
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `/Applications/Xcode.app/Contents/Developer/usr/bin/xcodebuild -project apps/macos/doc2md.xcodeproj -scheme doc2md -configuration Debug -derivedDataPath .build/mac-test test -quiet`
- `npm run build:mac`

Final fix validation:

- `npm test -- --run src/components/WorkingModeBar.test.tsx`
- `npm run lint`
- `npm run typecheck`
- `git diff --check`

## Review Outcome

Final canonical review backlog was empty. Reviewer A and Reviewer B both accepted the final overflow fix:

> Iteration 3 correctly fixes active working-mode clipping and preserves inactive/collapsed clipping behavior.

## Carry-Over Findings

No carry-over findings this round; nothing was inherited from earlier quests and nothing needs to be saved for the next one.

## This Is Where It All Began

Original idea: `ideas/doc2md-mac-session-restore.md`

> # Mac session restore (NSDocumentController + session.json reopen)
>
> Promoted out of `doc2md-ux-hardening-proposal.md` Phase 1. Two sub-pieces
> worth doing together.
>
> ## Existing partial coverage
>
> `apps/macos/doc2md/PersistenceStore.swift` already maintains a
> `recentFiles: [RecentFile]` array (max 10), persisted to
> `~/Library/Application Support/doc2md/settings.json`. It is NOT surfaced
> in the File menu yet - `MenuController.swift` has no Open Recent wiring.
>
> ## Sub-piece 1: NSDocumentController Open Recent submenu
>
> - Call `NSDocumentController.shared.noteNewRecentDocumentURL(_:)` from the
>   Mac shell whenever a file is opened or saved.
> - The standard File -> Open Recent submenu (with the system-provided "Clear
>   Menu" item) wires up automatically.
> - Replace the hand-rolled `PersistenceStore.recentFiles` storage with the
>   Apple-blessed shared `NSDocumentController` recent-document list.
>
> ## Sub-piece 2: session.json reopen-on-launch
>
> - Persist a small JSON file at
>   `~/Library/Application Support/doc2md/session.json` listing the absolute
>   paths of currently-open files that have a real path on disk.
> - Untitled / unsaved buffers are NOT eligible - only saved files.
> - Debounced write on open / close / save.
> - On launch, drop any paths that no longer exist and reopen the rest.
>
> ## Privacy
>
> List of paths, not contents. Same posture as any standard Mac editor.
>
> ## Tests
>
> - XCTest: `recordRecentFile` updates the shared NSDocumentController list.
> - XCTest: `session.json` is written on open and pruned on launch when a
>   path no longer exists.
> - Manual: open three files, quit, relaunch, all three reopen with the
>   same selection.

## Celebration

This journal embeds the celebration payload used by `/celebrate`.

- Replay locally: `/celebrate docs/quest-journal/ux-improvements-v2_2026-05-15.md`

## Celebration Data

<!-- celebration-data-start -->
```json
{
  "quest_mode": "workflow",
  "agents": [
    {
      "name": "planner",
      "model": "gpt-5.5",
      "role": "The Contract Cartographer"
    },
    {
      "name": "plan-reviewer-a",
      "model": "claude",
      "role": "The Native Trust Critic"
    },
    {
      "name": "plan-reviewer-b",
      "model": "gpt-5.5",
      "role": "The Layout Criteria Auditor"
    },
    {
      "name": "arbiter",
      "model": "claude",
      "role": "The Boundary Setter"
    },
    {
      "name": "builder",
      "model": "gpt-5.5",
      "role": "The Session Restorer"
    },
    {
      "name": "fixer",
      "model": "gpt-5.5",
      "role": "The Clipped Menu Surgeon"
    }
  ],
  "achievements": [
    {
      "icon": "SEC",
      "title": "Native Permission Boundary",
      "desc": "Restore state stays Markdown-only and native-owned."
    },
    {
      "icon": "UI",
      "title": "Compact Controls Restored",
      "desc": "Open, New, and theme toggle stay reachable in working mode."
    },
    {
      "icon": "VIEW",
      "title": "Preview Space Reclaimed",
      "desc": "Desktop and mobile preview heights start useful."
    },
    {
      "icon": "TEST",
      "title": "Overflow Contract Locked",
      "desc": "Active toolbar overflow is visible, inactive overflow remains hidden."
    }
  ],
  "metrics": [
    {
      "icon": "📊",
      "label": "Plan iterations: 2"
    },
    {
      "icon": "🔧",
      "label": "Fix iterations: 3"
    },
    {
      "icon": "🧪",
      "label": "Final backlog: 0"
    }
  ],
  "quality": {
    "tier": "Tin",
    "grade": "T"
  },
  "handoffs": {
    "overall": "19/21",
    "claude": "5/5",
    "codex": "14/16"
  }
}
```
<!-- celebration-data-end -->
