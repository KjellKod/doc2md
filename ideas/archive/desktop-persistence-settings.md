# Desktop Persistence Settings

## Status

Completed in the `desktop-persistence-settings_2026-04-28__2040` quest. See `docs/quest-journal/desktop-persistence-settings_2026-04-30.md`.

## Problem

The Mac desktop app currently behaves like the hosted web app in places where a native app should remember local preferences. Users reasonably expect the app to reopen with their last theme choice and to offer quick access to recently used files.

The hosted web app should remain stateless/free of desktop persistence behavior. This idea is only for the Mac desktop shell.

## Goal

Add a discreet desktop-only setting that enables local persistence for a small set of app preferences and recent-file metadata.

## Proposed Behavior

Add a compact settings control in the Mac app only:

- A discreet checkbox labeled `Persistence`.
- When enabled, the desktop app remembers:
  1. The latest `Day` or `Night` theme setting and applies it at next app start.
  2. The last 10 files used by the desktop app.
- When disabled, the desktop app clears persisted state.
- A separate `Clear persistence` action is optional. If included, it should either delete the settings file or empty its contents.

## Settled MVP Decisions

- Recent files appear in the desktop settings popover only.
- Recent entries are display-only and are not clickable in this MVP.
- Turning persistence back on starts with an empty recent-file list until the next successful native file operation.
- The app records successful Markdown opens, import-source opens, Save, and Save As paths.
- Reopening recent files from persisted paths is deferred until a future security-scoped bookmark or user-mediated open flow.

## Desktop-Only Boundary

- Do not show the setting in hosted web.
- Do not read or write the persistence file in hosted web.
- Do not add browser `localStorage` persistence as part of this feature.
- Keep all filesystem persistence behind the existing desktop bridge/native shell boundary.

## Persistence File

Use a small local settings file owned by the Mac app. The file should contain only non-secret app preferences and recent-file references.

Suggested shape:

```json
{
  "persistenceEnabled": true,
  "theme": "dark",
  "recentFiles": [
    {
      "path": "/Users/example/Documents/report.md",
      "displayName": "report.md",
      "lastOpenedAt": "2026-04-28T06:00:00Z"
    }
  ]
}
```

Notes:

- Keep at most 10 recent files.
- Dedupe recent files by path.
- Store no file contents.
- Store no credentials, signing material, API keys, or release secrets.
- If security-scoped bookmarks are needed later for reopening files, treat that as a separate implementation decision and keep it Mac-only.

## UI Notes

- Keep the control small and work-focused.
- Prefer a small settings popover/menu over adding another large toolbar section.
- `Persistence` should make it clear that recent files and theme memory are local to the Mac app.
- Disabling the checkbox should immediately clear persisted data so the user does not need to find a second destructive action.
- If a separate `Clear persistence` button exists, it should be available only when persistence is enabled or persisted data exists.

## Acceptance Criteria

- Hosted web does not show persistence settings.
- Hosted web does not gain new local persistence behavior.
- Mac app can enable/disable persistence through a visible setting.
- When enabled, Mac app restores the last Day/Night setting on launch.
- When enabled, Mac app records and displays up to 10 recently used files.
- When disabled, persisted theme and recent-file data are cleared.
- Recent files never store document contents.
- Existing open/save/import/conversion semantics remain unchanged.

## Open Questions

- None for the MVP. Bookmark-backed reopen, File menu recents, and a separate clear action remain possible follow-up ideas.
