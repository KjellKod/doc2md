# Desktop Persistence Settings

- **Quest ID:** `desktop-persistence-settings_2026-04-28__2040`
- **Completion date:** 2026-04-30
- **Mode:** workflow
- **Plan iterations:** 2
- **Fix iterations:** 1
- **Outcome:** Complete

## Summary

Added a desktop-only persistence setting for the Mac app. When enabled, the native shell stores a small Application Support JSON settings file with `persistenceEnabled`, optional Day/Night theme, and up to 10 recent-file metadata entries. The hosted web app remains stateless and does not gain a persistence UI or browser storage behavior.

The implementation adds a Swift `PersistenceStore`, version-2 bridge methods and capability gating, a compact React desktop settings popover, recent-file refresh after successful native file operations, typed theme persistence, focused tests, Mac README documentation, and native API allowlist updates.

## Files Changed

- `.quest-manifest`
- `apps/macos/README.md`
- `apps/macos/doc2md.xcodeproj/project.pbxproj`
- `apps/macos/doc2md/PersistenceStore.swift`
- `apps/macos/doc2md/ShellBridge.swift`
- `apps/macos/doc2mdTests/PersistenceStoreTests.swift`
- `ideas/desktop-persistence-settings.md`
- `scripts/build-mac-app.sh`
- `src/App.tsx`
- `src/App.test.tsx`
- `src/__tests__/App.desktop.test.tsx`
- `src/components/ThemeProvider.tsx`
- `src/desktop/**`
- `src/hooks/themeContext.ts`
- `src/hooks/useTheme.test.tsx`
- `src/styles/global.css`
- `src/types/doc2mdShell.d.ts`

## Validation

- `bash scripts/quest_validate-manifest.sh` passed after the fixer updated `.quest-manifest`.
- `npm test -- --run` passed with 45 files / 410 tests.
- `npm run lint` passed.
- `npm run typecheck` passed.
- `npm run build` passed.
- `npm run build:desktop` passed.
- `python3 scripts/security_ci_guard.py` passed.
- Builder validation also passed `bash scripts/build-mac-app.sh --configuration Release`.
- Builder native XCTest passed with `DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer`.
- Fixer native `xcodebuild -list` could not run because the active developer directory was Command Line Tools.

## Review

Initial code review found five actionable issues across both reviewers:

- Quest manifest validation failed.
- Enabling persistence after selecting Day mode did not immediately persist the current theme.
- `restoredThemeRef` lifecycle cleanup was too implicit.
- Persistence bridge errors collapsed into a generic unavailable notice.
- The native placeholder write path needed explicit documentation.

The fixer resolved all five. Final dual code review returned `next: null` from both reviewers.

## Celebration Data

<!-- celebration-data-start -->
```json
{
  "quest_id": "desktop-persistence-settings_2026-04-28__2040",
  "quest_mode": "workflow",
  "slug": "desktop-persistence-settings",
  "quality_tier": "Gold",
  "plan_iterations": 2,
  "fix_iterations": 1,
  "review_count": 4,
  "achievements": [
    "Native Application Support settings store",
    "Version-2 bridge capability gate",
    "Hosted web stateless boundary preserved",
    "Immediate Day/Night persistence on enable",
    "One fixer pass to clean final review"
  ],
  "validations": [
    "npm test -- --run",
    "npm run lint",
    "npm run typecheck",
    "npm run build",
    "npm run build:desktop",
    "python3 scripts/security_ci_guard.py",
    "bash scripts/build-mac-app.sh --configuration Release"
  ],
  "quote": "Iteration 2 review: all five prior findings resolved; manifest, tests, lint, typecheck green; no new blocking issues."
}
```
<!-- celebration-data-end -->
