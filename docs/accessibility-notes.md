---
title: Accessibility Notes
purpose: Audit checklist for the doc2md editor surfaces. Updated when accessibility-relevant code changes.
audience: contributors and reviewers
status: active
---

# Accessibility Notes

This document captures the accessibility contract for the doc2md editor surfaces.
It is the audit checklist reviewers should consult when changing the editor,
find/replace bar, save controls, or the upload/working-mode chrome.

## Save status (`SaveStatePill`)

- The pill exposes `role="status"`, `aria-live="polite"`, and `aria-atomic="true"`.
- Text changes are announced by screen readers without stealing focus.
- The relative-time variant (`Saved · 2s ago`) reuses the same semantics — the
  underlying tick updates the text node only.
- `state === "edited"` renders as `Unsaved` so the label matches the
  before-unload prompt the browser shows when the user navigates away.

## Find & Replace

- `find-replace-bar` exposes `role="search"` with an `aria-label`.
- All option toggles (Match case, **Match whole word**, Use regex, Show replace)
  expose `aria-pressed` reflecting their on/off state and an `aria-label`.
- Tooltips are linked via `aria-describedby` so the hover hint is also
  announced to screen readers.
- The match counter (`12 of 47` or `5000+ more` when capped) is rendered with
  `aria-live="polite"` so navigation announcements are subtle.
- Replace and Replace All buttons use `onMouseDown={event.preventDefault()}`
  to preserve textarea focus on click — this is a UX detail, not an a11y
  regression: keyboard activation via Space/Enter still focuses the button.
- `Escape` closes the find bar from any of its inputs/buttons and returns
  focus to the textarea.

## Editor keyboard contract

- The textarea is labeled `aria-label="Edit markdown"`.
- The editor reacts to:
  - `Cmd/Ctrl + B`, `Cmd/Ctrl + I`, `Cmd/Ctrl + K` — wrap selection.
  - `Cmd-Shift-7/8/9` — toggle ordered, unordered, task list.
  - `Cmd/Ctrl + F` — open find bar.
  - `Cmd-Alt-F` — open find bar with replace expanded.
  - Smart-wrap on `*`, `_`, `` ` ``, `[`, `(`, `"` only when a selection
    is active (caret-only typing inserts the character as-is).
- IME composition is guarded by `event.isComposing` AND an
  `isComposingRef` driven by `compositionstart`/`compositionend`. Auto-continue
  on Enter does NOT fire during composition.

## Shortcut reference contract

- The compact shortcut reference is discoverability for existing shortcuts, not
  a command palette or settings surface.
- It lists Save only when the active shell exposes a real save shortcut
  (`Meta+S` in the Mac desktop shell today). Hosted browser Save remains a
  button/download action with no claimed global shortcut.
- It does not list mode-switch shortcuts because Edit, Preview, and LinkedIn
  mode changes are button actions today.
- It may list Escape only for existing close/dismiss behavior such as the
  find/replace bar, desktop Recent menu, and the reference popover itself.

## Working-mode auto-collapse

- The sidebar collapse and rail buttons retain their explicit `aria-label`
  values ("Hide upload panel", "Show upload panel").
- Auto-collapse fires at most once per session and only when the user has
  not manually adjusted the sidebar (tracked via `userTouchedSidebarRef`).
  This avoids the "the app keeps closing my sidebar" anti-pattern for
  screen-reader users who rely on the file list rail.
- Scratch drafts (`Start writing`) do NOT trigger auto-collapse — the
  upload panel stays visible when the user has not actually opened a file.

## Working-mode bar and desktop Recent menu

- The working-mode logo is a real button with visible `doc2md` text and
  `aria-label="Home"`. It returns to Landing chrome without clearing entries
  or resetting the one-shot auto-collapse guard.
- Browser working mode exposes plain Open and New buttons. Browser-side
  Recent files remain deferred.
- Desktop working mode exposes Recent files from the Open button only when
  `recentFiles.length > 0`. In that state, Open has `aria-haspopup="menu"`,
  `aria-expanded`, and `aria-controls`; with no recents it is a plain Open
  button with none of those menu attributes.
- The Recent panel uses `role="menu"` and `role="menuitem"` children. The first
  item is `Browse...`; the remaining items are recent file paths from desktop
  persistence.
- Opening the Recent menu moves focus to `Browse...`. Tab and Shift+Tab wrap
  within the menu, Arrow Up/Down moves between items, Enter/Space activates the
  focused item, and Escape closes the menu and returns focus to Open.
- Clicking outside the Recent menu dismisses it. The settings-popover Recent
  list remains display-only; actionable Recent opens live in the working-mode
  Open popover.

## Before-unload guard

- The `beforeunload` listener is only installed while at least one entry has
  `entrySaveStates[id] === "edited"`. The browser is the source of truth for
  whether the prompt is displayed (modern browsers require prior user
  interaction with the page before honoring `beforeunload`).
- The listener is removed on cleanup so navigating away from the App
  component (e.g., HMR, route change) does not leak a global handler.

## Out-of-scope (tracked in follow-up quests)

- WCAG audit/certification matrices, Lighthouse accessibility targets,
  screen-reader audits, broad focus-ring redesigns, command palettes, shortcut
  remapping/settings, and aspirational shortcut lists are outside the Step 5
  keyboard-discoverability contract.
- Cross-browser Playwright coverage (only Chromium ships today). See
  `ideas/doc2md-multibrowser-playwright.md`.
- True browser crash recovery (reload-surviving drafts). See
  `ideas/doc2md-browser-crash-recovery.md`.
- Mac file watchers and session restore via NSDocumentController. See
  `ideas/doc2md-mac-file-watchers.md` and
  `ideas/doc2md-mac-session-restore.md`.
