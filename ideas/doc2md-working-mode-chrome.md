# Working-mode chrome — finish the two-mode layout

## Why this exists

`ideas/doc2md-ux-hardening-proposal.md` called for a **two-mode layout**
(Landing mode unchanged, Working mode collapses everything above the
editor into a thin chrome). Phase 1 of `doc2md-ux-hardening` shipped only
the sidebar auto-collapse — the hero, the upload card, the format chips,
and the return-to-landing affordance were not addressed. This follow-up
closes that gap.

## What the proposal asked for (verbatim)

> **Working mode** (document loaded) collapses the hero to just the logo,
> turns the upload card into a slim "Open / New / Recent" button group,
> moves the file list into a left rail that defaults collapsed, and gives
> the editor full bleed. One toolbar row above the editor: Edit | Preview
> | LinkedIn — gap — Find — Save (with a "Saved · 2s ago" inline status
> that replaces the green chip). That's it.
>
> Transition is automatic on first file open and on the first paste over
> ~200 characters. Clicking the logo or a persistent "Home" affordance
> returns to landing mode. No new settings. No "compact view" toggle.
> The app reads what state you're in and adjusts.

## Gap analysis — what's done vs. what's left

| Element | Proposal | Shipped in Phase 1 | Status |
|---|---|---|---|
| **Hero** (`PRIVATE MARKDOWN WORKSPACE`, h1 "Edit or convert to Markdown…", supported-formats sub-paragraph) | "Collapses the hero to just the logo" | Still showing in full | ❌ |
| **Upload card** | "Turns the upload card into a slim 'Open / New / Recent' button group" | Only collapsed behind the existing rail; no thin button group | ❌ |
| **File list** | "Moves the file list into a left rail that defaults collapsed" | Lives behind the rail | ✅ |
| **Editor** | "Gives the editor full bleed" | Partial — right pane is full bleed but the hero still eats vertical space | ⚠️ |
| **Toolbar row** | "One toolbar row: Edit | Preview | LinkedIn — gap — Find — Save (with 'Saved · 2s ago')" | Already in `PreviewPanel` toolbar; matches the spec | ✅ |
| **Transition trigger** | "Automatic on first file open AND on first paste over ~200 chars" | First-file-open ships; paste-trigger explicitly deferred in plan §1 | ⚠️ |
| **Return to landing** | "Clicking the logo or a persistent 'Home' affordance returns to landing mode" | Not implemented | ❌ |
| **Format chips** (the `.md`/`.txt`/`.json`/... badges in the hero copy) | Implicit: not visible in working mode (part of the hero block) | Still visible | ❌ |
| **Install tab** | "Stays exactly as it is today" in landing; not mentioned for working mode but implied to remain reachable via the view-switcher | Visible in both modes; arguably noise in working mode | ⚠️ |

## Implementation sketch (small PR)

### Scope

1. **Collapse the hero in working mode.** Hide `.hero` (h1 + sub-paragraph
   + format chips eyebrow text) when a non-scratch entry is selected.
   Replace with a thin top bar that contains:
   - Logo / wordmark on the left (clickable — returns to landing).
   - Small "Open · New" button strip on the right.
   - The view-switcher (Convert / Install & Use) becomes secondary —
     either fold it into a dropdown OR move it out of the working-mode
     bar entirely.
2. **Add a Home affordance.** Clicking the logo (or a dedicated Home
   icon-button) clears the working-mode chrome and returns to landing.
   Mechanism: do NOT clear entries — they stay in session memory; just
   flip the mode flag. A subsequent file open or "switch to entry" click
   re-enters working mode without auto-collapse firing again (the
   one-shot guard stays consumed).
3. **Recent files on desktop.** Mac shell already maintains
   `PersistenceStore.recentFiles`. Surface them as a small popover off
   the "Open" button group. Browser shows just Open + New (no recent
   list yet — that's the deferred `doc2md-browser-crash-recovery` quest).
4. **(Optional) Paste-trigger transition.** Enter working mode when a
   single paste over ~200 chars happens into the editor. Requires
   careful UX — surprise layout shift on paste is bad. Probably gate
   behind a small "Switch to working mode" toast rather than auto.

### Files touched

- `src/App.tsx` — new `isWorkingMode` derived state; conditional render of
  hero vs. working-mode bar.
- `src/desktop/DesktopApp.tsx` — mirror.
- `src/components/WorkingModeBar.tsx` (new) — the thin top bar.
- `src/styles/global.css` — sizing + transition rules for the new bar.
- `src/components/FileList.tsx` — verify the file list still mounts the
  same way when sidebar re-expands from the rail.

### Tests

#### Playwright

- Working-mode bar replaces the hero when a non-scratch entry is selected.
  Assert `.hero h1` is not visible AND the new working-mode bar IS visible.
- Click the logo / Home affordance → hero h1 visible, working-mode bar
  hidden. Entries are still in session memory (file list still has them
  when the user re-expands the sidebar).
- After return-to-landing then re-selecting an entry, working-mode chrome
  re-applies WITHOUT another auto-collapse animation (the one-shot guard
  remains consumed).
- "Open" and "New" buttons in the working-mode bar function (single click
  triggers the same flows as the existing upload/new buttons).

#### Unit / integration

- `App.test.tsx`: assert the hero is hidden when `selectedEntry` is set and
  non-scratch.
- `DesktopApp.test.tsx`: same for the desktop tree.
- A snapshot or layout test for the working-mode bar (height, button order).

#### Manual Mac validation

- `npm run build:mac && open .build/mac/Build/Products/Release/doc2md.app`.
  Verify the hero collapses on first file open, Home affordance returns to
  landing, and the editor gets noticeably more vertical space.

## Out of scope for this follow-up

- Paste >200-char trigger (UX design needed; defer to a separate ticket
  if we want it).
- Browser-side Recent files (requires the reload-survival quest first;
  see `doc2md-browser-crash-recovery.md`).
- A "compact view" user toggle (proposal explicitly says no — the app
  reads state and adjusts; no settings).

## Definition of done

- Hero hidden in working mode; logo + Open/New shown instead.
- Logo click returns to landing mode.
- Format chips moved out of the working-mode chrome (they remain in
  landing).
- All Playwright + unit tests green; Mac manual validation pass.
- Phase 1 PR description updated (or this quest gets its own PR) so
  future readers know what was deferred and where the work landed.
