# Resize Handle Rework: 2D Corner → Conventional Split-Pane

## Why

The current 2D bottom-right corner handle on `.preview-panel` was the
right tool to validate that resize works at all, but it is non-standard
inside a desktop app pane and produces a "wrong side is moving"
cognitive tax — the corner handle implies "resize this panel" but
horizontally it actually shrinks the sidebar on the left. Two pieces
of evidence forced the redesign:

1. **Industry pattern (Mac/Win/Web).** Zero of the surveyed apps
   (VS Code, Zed, Obsidian, Bear, iA Writer, Notion, Linear, Finder,
   Xcode, Mail, Slack, Figma, Sketch, Photoshop, Logic, Final Cut)
   use a 2D corner handle inside a pane. The universal pattern is a
   **single-axis edge bar between panes**.
2. **Apple HIG/AppKit precedent.** Apple's `NSSplitView` ships
   constraints named literally
   `NSLayoutPriorityDragThatCannotResizeWindow` (490) and
   `DragThatCanResizeWindow` (510), separating internal-divider drags
   from window-edge drags by design. The 2D corner handle conflates
   the two semantics.

The product has proven the resize mechanism works end-to-end; now
the affordance should match what Mac users already know.

## Goal

Replace the single 2D corner handle with two industry-standard
edge-of-pane handles:

1. **Vertical split bar** between the sidebar and the preview panel
   — adjusts horizontal split.
2. **Horizontal handle** along the bottom edge of the preview panel
   — adjusts editor/preview height.

Behavior matches the existing internal-redistribution model:
horizontal drag still shrinks the sidebar (does not resize the OS
window); vertical drag still grows the preview panel.

## Locked design decisions

These are decided, not open questions. The plan in the follow-up
branch should implement, not re-litigate.

### Library vs hand-roll

**Hand-roll.** Reasons:
- `react-resizable-panels` would force us to restructure the
  workspace as `<PanelGroup><Panel><PanelResizeHandle /><Panel></>`.
  That's a meaningful refactor across two app shells, and the
  library's defaults (e.g., percent-based widths) clash with our
  current pixel-based clamps.
- The actual code for two single-axis drag handles is ~80 lines
  total. We already have the mousedown/mousemove/mouseup state
  machine from the current implementation; only the geometry changes.
- Hand-rolled keeps both `App.tsx` and `DesktopApp.tsx` parallel
  without introducing a dep that both must wrap identically.

### Geometry

- **Vertical split bar position**: sits in the workspace grid's
  `gap` between column 1 (sidebar) and column 2 (preview panel).
  Convert the workspace from
  `grid-template-columns: minmax(350px, 430px) minmax(0, 1fr)` (gap
  24px) to
  `grid-template-columns: var(--sidebar-width) 8px minmax(0, 1fr)`
  with the new 8px column holding the bar.
- **Horizontal handle position**: a strip along the bottom edge of
  `.preview-panel`, positioned absolute, full width, 6px tall.

### Hit area

- **Visible thickness**: 6px (vertical bar) / 6px (horizontal bar).
- **Effective hit area**: 24px via CSS `::before` pseudo-element
  extending the pointer-receiving area in both directions (12px
  outward on each side) — meets WCAG 2.5.8 target-size minimum
  without thickening the visible UI.
- **Hover state**: bar opacity 0.5 default, 1.0 on hover/active.
- **Cursor**: `col-resize` on vertical bar, `row-resize` on
  horizontal handle.

### Defaults & limits

- **Sidebar width**:
  - Default: 430px (matches current CSS minmax max).
  - Min before snap-collapse: 200px.
  - Snap-collapse threshold: dragging the sidebar narrower than
    200px snaps it to the existing 56px rail state via the existing
    `sidebarCollapsed` toggle (re-use, don't duplicate state).
  - Max: 430px.
- **Editor height**:
  - Default: derived from CSS (`min-height: 700px` on
    `.preview-panel`).
  - Min: 240px (same as current `MIN_EDIT_SHELL_HEIGHT`).
  - Max: 2400px (same as current `MAX_EDIT_SHELL_HEIGHT`).
- **Persistence**: persist `sidebarWidth` and `editShellHeight` to
  the existing desktop persistence settings record alongside theme.
  Web variant uses `localStorage`. Out of scope if it adds review
  surface; current behavior of resetting on reload is acceptable
  v1.

### Double-click reset

- **Double-click the vertical bar** → reset sidebar to default
  (430px).
- **Double-click the horizontal handle** → reset editor height to
  null (let CSS reclaim).
- Modeled after VS Code's `workbench.action.evenEditorWidths`
  behavior — a strong industry signal across VS Code, Zed, and the
  Obsidian community's #1 sash request.

### Keyboard

- **Vertical bar focused, Arrow Left/Right** → 16px step (smaller
  than the current 48px because users with keyboard control want
  fine adjustment, not coarse jumps).
- **Horizontal handle focused, Arrow Up/Down** → 32px step.
- **Home on either** → reset that axis to default.
- **Tab order**: bar and handle are both keyboard-focusable buttons
  (`role="separator"` per ARIA APG, `tabindex={0}`,
  `aria-orientation` set).

### Snap-to-collapse behavior

- During a drag, if the user releases the mouse with
  `sidebarWidth < 200`, snap to 56 (collapse rail) by setting
  `sidebarCollapsed = true`.
- Re-opening the rail by clicking the existing collapse-rail button
  restores `sidebarWidth` to its previous value (so a user who
  collapsed via drag doesn't get a tiny 200px sidebar back — they
  get the previous size).

## Migration plan

### Files removed/changed

- `src/desktop/DesktopApp.tsx`
  - **Delete** `MoveDiagonalIcon` (no longer used).
  - **Delete** the corner handle button (the `<button
    className="page-resize-handle">`).
  - **Replace** the `previewPanelStyle` inline style (already does
    height/min-height) with the same plus a new
    `workspaceStyle` that uses
    `grid-template-columns: var(--sidebar-width)px 8px minmax(0, 1fr)`.
  - **Add** two new buttons: `<SplitBar />` and
    `<HeightHandle />`, each with its own mousedown handler.
  - **Keep** the existing `sidebarWidth`, `editShellHeight`,
    `dragStartXRef`, `dragStartYRef` state but split into two
    independent drag tracks (one for each handle).
- `src/App.tsx` — mirror the same changes.
- `src/styles/global.css`
  - **Remove** `.page-resize-handle` rule and its hover/focus
    states.
  - **Add** `.workspace-split-bar` (vertical) and
    `.preview-height-handle` (horizontal) with hit-area
    pseudo-elements and theme-aware colors.
  - **Remove** `.preview-panel { overflow-x: hidden }` once the
    column structure changes; the new third grid column absorbs
    the bar without overflow.
- `src/App.test.tsx`
  - The two existing tests are obsolete (they assert the corner
    handle's aria-label and grid-template behavior). Rewrite as:
    - "lets users drag the sidebar narrower via the split bar"
    - "lets users grow the editor height via the bottom handle"
    - "double-click the split bar resets the sidebar width"
- `tests/e2e/view-anchor-mode-switch.spec.ts`
  - The resize-by-page-max-width step uses `evaluate()` to set
    `--page-max-width`. Since horizontal drag no longer touches
    that var, the spec already doesn't depend on the handle
    behavior. Should be unaffected, but verify on the migration
    PR.
- One **new** Playwright spec
  `tests/e2e/resize-handles.spec.ts`:
  - Vertical bar exists, has `role="separator"` with
    `aria-orientation="vertical"`.
  - Horizontal handle exists, has `role="separator"` with
    `aria-orientation="horizontal"`.
  - Drag right on the vertical bar narrows the sidebar; mouseup
    below 200px snaps to collapse-rail.
  - Double-click vertical bar resets sidebar width.
  - Drag down on the horizontal handle grows the editor.

### State migration

- The current `sidebarWidth: number | null` state stays. Add a
  separate `dragTarget: "sidebar" | "height" | null` to disambiguate
  which handle the user grabbed (so mousemove only updates the
  axis the user is actually dragging — fixes the current
  "horizontal drag also affects height" coupling for keyboard users
  who don't actually intend a 2D move).
- The existing `pageMaxWidth` state can be left in place since
  Home reset still uses it; no drag updates it.

## Out of scope

- **Snap-to-percent gestures** (e.g., dragging close to 50/50 snaps
  there). Add if user testing shows demand.
- **Cross-session persistence of width/height** beyond what the
  current desktop persistence settings support. Defer.
- **"Grow OS window when pane hits floor"**. Researched; zero apps
  do this; Apple HIG actively discourages it
  (`DragThatCannotResizeWindow`). Don't build.
- **Touch / pen handling**. The target hit area meets WCAG for
  pointer; native touch gesture support is a separate concern.
- **Re-themeable handle colors**. Use existing accent var and
  neutral border vars only.
- **The PreviewPanel split refactor** described in
  `ideas/preview-panel-refactor.md` is a separate, larger piece of
  work. This rework should not block on it; it's local to the
  outer shell.

## Acceptance

- Two visible handles where the user expects them. Vertical bar
  between sidebar and preview; horizontal handle at the bottom of
  the preview panel.
- Drag behavior on each is single-axis only — the bar moves only
  horizontally, the handle moves only vertically.
- Double-click each → reset that axis to default.
- WCAG-compliant 24px effective hit area.
- Sidebar snap-collapses at 200px floor.
- Existing 506 Vitest + 13 Playwright cases pass after the two
  obsolete tests are rewritten and the new spec is added.
- Mac Release manual validation: open a long doc, drag the
  vertical bar right → sidebar narrows, preview widens; release
  past 200px → snaps to rail; drag the horizontal handle down →
  editor grows; double-click each → resets.

## Effort

~3–5 hours of focused work in a dedicated `feature/split-pane-handles`
branch off main once `find-search-v2` lands. Two files of geometry
(`DesktopApp.tsx`, `App.tsx`), one file of CSS
(`src/styles/global.css`), one Playwright spec, two Vitest test
rewrites.

## Status

Documented. Not yet implemented. Pick this up after
`find-search-v2` (PR #114) merges so the rework lands on a clean
base.
