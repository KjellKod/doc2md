# PreviewPanel Refactor: Split Modes + Dedup App Shells

## Why

`src/components/PreviewPanel.tsx` is 1038 lines, 29 hooks, 10 `useEffect`/
`useLayoutEffect`. It owns nine distinct concerns: view-mode state, find
bar wiring, DOM-mutation highlighting, viewport anchor capture/apply,
LinkedIn segmentation, copy-to-clipboard, Cmd+F interception, source-line
metadata, and find-overlay scroll sync. Every find or anchor bug ends up
forcing a change inside this one component, and the change has to be
tested against three view modes plus find-on/find-off plus
edit-mode/preview-mode/linkedin-mode. The blast radius per change is too
large.

`src/desktop/DesktopApp.tsx` (2239 lines) and `src/App.tsx` (756 lines)
are a copy-paste pair. They share: page-width state, edit-shell-height
state, drag-handle handlers, view-switcher + dynamic pill, hero copy,
preview-panel wiring, drop-zone wiring, install page. Every desktop
fix lands twice.

These structural choices are the load-bearing reason recent bugs
(rendered-surface find leaks, find-match drift, edit-leaks-into-preview)
keep recurring near the find / mode-switch seam.

## What

Two follow-up refactors, in this order:

### 1. Split `PreviewPanel` into mode components

```
src/components/preview/
  PreviewPanel.tsx          // thin shell: mode switcher + toolbar + body slot
  EditMode.tsx              // textarea + mirror + edit-mode anchor wiring
  PreviewMode.tsx           // markdown-surface + rehype + preview-mode anchor wiring
  LinkedInMode.tsx          // per-line spans + linkedin-mode anchor wiring
  useViewportAnchor.ts      // capture/apply hook (wraps viewportAnchor helpers)
  useFindHighlight.tsx      // remark plugin + match-overlay rendering (no DOM mutation)
```

The three `<Mode>` components are siblings, conditionally mounted by
`PreviewPanel`. Each one owns its surface, its ref, its anchor capture,
and its highlight rendering. They share state via a small props
contract: `entry`, `effectiveMarkdown`, `activeFindMatch`,
`isFindOpen`, `onMarkdownChange`. Nothing else.

`useViewportAnchor()` returns `{ captureAnchorLine, applyAnchorLine }`
keyed off a ref the mode component owns. The hook hides whether the
mirror or the rendered surface is in scope; the mode component just
calls capture before unmount and apply after mount.

`useFindHighlight()` returns a remark plugin that wraps the active
match's character range in a `<mark>` AST node during the React
render. **No `document.createRange`, no `extractContents`, no
`replaceWith`.** React owns the highlight; mode switches and re-renders
no longer fight the reconciler.

### 2. Collapse `App.tsx` + `DesktopApp.tsx` into an `AppShell`

```
src/shell/
  AppShell.tsx              // shared layout, hero, view switcher, panels, resize handle
  useWorkspaceResize.ts     // page width + edit-shell height state + handlers
  desktopAdapter.tsx        // desktop-only: save state, conflict bar, native menu bridge
  webAdapter.tsx            // web-only: download save, theme persistence (web variant)
```

`AppShell` takes platform-specific slots (save controls, status pill,
reload affordance) from whichever adapter mounts it. The 99% copy-paste
across the two top-level components disappears.

## Risk

Both refactors are mechanical once the contracts are written. Risks:

- **Find highlight remark plugin** must preserve current visuals (mark
  color, zero-width-match indicator, scroll-into-view behavior). Test
  the four cases: plain match, zero-width match, regex match across
  inline emphasis (`**bold** text`), match at start-of-document.
- **Viewport anchor hook** must continue to work across resize +
  mode switch + soft-wrapped paragraphs. The existing
  `tests/e2e/view-anchor-mode-switch.spec.ts` covers most of this; add
  a fixture that opens find and verifies highlight survives mode switch
  without DOM contamination.
- **`AppShell` dedup** has the most surface area but the lowest
  per-change risk because the underlying logic is already proven; this
  is purely deduplication.

## When

Not blocking. Schedule after the four targeted bug-fix branches in
`ideas/bug_report_*` land and stabilize. Recommend doing the
`useFindHighlight` split first because it removes the DOM-mutation
contamination that has produced three of the four recent bugs.

## Out of scope

- Rewriting in another language. The bugs are not language-caused. See
  the architectural analysis attached to the conversation that produced
  this doc; the path forward is a surgical refactor, not a rewrite.
- Changing the converter pipeline, save semantics, Sparkle/notarization
  plumbing, or licensing boundary.
- Theme system changes.
