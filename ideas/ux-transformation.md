# doc2md UX transformation

Status: active idea
Successor to: [`archive/doc2md-ux-hardening-proposal.md`](archive/doc2md-ux-hardening-proposal.md)

doc2md already does the hard part: private, local document-to-Markdown conversion across the hosted app, the Mac desktop app, and `@doc2md/core`. The next UX step is not a rewrite. It is a restrained transformation toward a workspace that feels appealing, clear, and intuitive without turning every idea into product surface.

North star: **appeal + clarity + intuitive workspace**.

This document inherits the previous proposal's KISS discipline. Small, concrete improvements are allowed when they score `need` or `if-needed`. Anything that needs a new subsystem, public API break, or user-model change must earn that scope in its own proposal.

## Fixed constraints

These are settled constraints, not open debate:

- **KISS / SRP / YAGNI** from `AGENTS.md`: every proposal below must be small enough to review and must avoid speculative UI systems.
- **Accessibility contract** from `docs/accessibility-notes.md`: the save pill, find bar, editor keyboard behavior, recent menu, and before-unload guard are the baseline to preserve.
- **Desktop is not a browser** from PR #138: the Mac webview is a thick client around doc2md, not a general web browser. External links leave the shell.
- **No native HTML `title` tooltips**: tooltips use the project's instant custom pattern with `role="tooltip"` and `aria-describedby`.
- **No source-file surprises**: converted source documents are import-only until the user explicitly saves Markdown elsewhere.
- **No breaking changes by accident**: any breaking change needs a dedicated "Breaking change rationale" block before it can leave ideas space.

## Scoring vocabulary

This follows `docs/ideas-audit-2026-05-14.md`:

- `need`: should ship soon because it improves a real current workflow or removes current confusion.
- `if-needed`: valuable, but wait for a concrete trigger or a larger positioning decision.
- `yagni`: do not ship unless we explicitly walk back the rationale.

Surfaces:

- **Hosted**: the static web app at the GitHub Pages surface.
- **Mac**: the Swift + WKWebView desktop app.
- **Core**: `@doc2md/core` API and CLI.

Every item must explicitly mark Hosted, Mac, and Core as `yes`, `if needed`, `no`, `n/a`, or `docs only` with one-line rationale. No implicit surface coverage.

## Transformation map

| Item | Hosted | Mac | Core | Gut | Why |
|---|---:|---:|---:|---|---|
| Workspace real-estate and working-area density | yes | yes | n/a | `need` | Editing and previewing are the core working tasks, but the shared shell can still make document content feel cramped through vertical chrome, default split choices, and repeated manual resizing. |
| Theme parity audit | yes | yes | n/a | `need` | Theme support exists, but the product needs a deliberate light/dark pass across editor, preview, highlights, errors, empty states, menus, and disabled states. |
| Mobile and tablet layout pass | yes | n/a | n/a | `need` | Hosted web is a browser product. Phone and tablet layouts should not be incidental desktop collapse behavior. |
| Performance perception pass | yes | yes | yes | `need` | Conversion, search, paste, batch output, and remote fetch all need visible, honest progress or bounded waiting. |
| Onboarding clarity | yes | yes | yes | `need` | First-run copy should make the user's next action obvious without restating the architecture. |
| Empty-state copy pass | yes | yes | yes | `need` | Empty states are the first onboarding screen. They should name the action that fills them. |
| Error-state copy pass | yes | yes | yes | `need` | Errors should say what happened, why if known, and what the user can do next. |
| Copy-paste UX loop | yes | yes | if needed | `need` Hosted/Mac, `if-needed` Core | Paste-to-Markdown has shipped; now the product should make paste, copy Markdown, and copy LinkedIn feel intentional and discoverable. Core remains if-needed until a concrete CLI/script paste workflow exists. |
| Keyboard discoverability | yes | yes | n/a | `need` | Enough real shortcuts now exist to justify a compact reference. No command palette. |
| Lightweight a11y audit | yes | yes | docs only | `need` | Phase 6f can be revived now as a focused audit against the existing accessibility contract. |
| Custom tooltip cleanup | yes | yes | n/a | `need` | Native `title` tooltips are too slow and inconsistent. Existing `title=` uses should be replaced where they are user-facing hints. |
| Block move and select next occurrence | yes | yes | n/a | `if-needed` | Useful editor muscle memory, but only worth shipping if the textarea implementation stays simple or the editor engine changes for other reasons. |
| Folder view as local workspace | if needed | if needed | n/a | `if-needed` | Real workspace value, but still a larger positioning move toward "local markdown workspace". |
| Browser crash recovery | if needed | n/a | n/a | `if-needed` | Valuable only after a real data-loss trigger or a broader hosted-workspace push. |
| Hosted scratch-buffer preservation | if needed | n/a | n/a | `if-needed` | Parked Phase 6g item: session-local scratch buffer so refresh or accidental navigation does not erase unsaved hosted-browser work. |
| Mac file watchers | n/a | if needed | n/a | `if-needed` | Save-time mtime checks already catch the common case. Live watchers wait for a real iCloud/Dropbox conflict report. |
| System theme follow | if needed | if needed | n/a | `if-needed` | Useful after parity is proven. Do parity first; automatic system sync can wait. |
| Command palette / shortcut remapping | no | no | n/a | `yagni` | Too much product surface for today's app. A compact reference solves discoverability without building an IDE. |
| Formal WCAG certification matrix | no | no | n/a | `yagni` | A lightweight audit is enough. Certification-level work is not proportional today. |
| Source-tree file operations | no | no | n/a | `yagni` | Rename, move, delete, and two-way folder sync would turn doc2md into a file manager. |

## Need items

### Workspace real-estate and working-area density

Surfaces: Hosted, Mac.

Gut: `need`.

The current workspace problem is not "the app needs a full visual redesign." It is more concrete: while working on a document, the editor and preview should own the dominant share of the viewport, but the shared shell can still spend too much space above the workspace and inside it through page padding, panel chrome, headings, toolbars, default split widths, and resize recovery. Working mode already hides the landing hero and view switcher, which is the right direction, but users should not need repeated left/right/up/down adjustments before editing feels comfortable, and the document area should not still feel cramped after adjustment.

Affected surfaces:

- Hosted: yes. The browser app owns the responsive shell, working-mode bar, sidebar collapse, preview/editor panel, toolbar placement, and laptop/tablet viewport behavior.
- Mac: yes. The desktop app shares the same React `AppShell`, preview panel, working-mode bar, and resize contracts, while preserving Mac-specific native menus, save/reload/reveal behavior, and "desktop is not a browser" link routing.
- Core: n/a. `@doc2md/core` has no workspace chrome. Do not change API, CLI, conversion semantics, or result shapes for this item.

Treat this as distinct from:

- theme parity, which checks visual states in light/dark
- mobile and tablet layout, which handles touch and narrow responsive behavior
- copy polish, which clarifies labels and errors
- folder view, which would change product positioning toward a local Markdown workspace

Mobile and tablet layout is related, but it is not the same problem. This item starts with common laptop and desktop working space, then records where narrow tablet behavior needs coordination with the separate mobile/tablet pass.

Decision frame:

- Targeted layout compaction: likely first move. Reduce or collapse non-document chrome, make panel headings and toolbar rows earn their height, and tighten spacing where it increases editor/preview acreage without hiding required controls.
- Workspace-first working mode: keep the current state-based direction, but make the working state feel intentionally document-first. The landing story should stay available through Home; it should not continue to tax the working viewport.
- Focus/fullscreen writing mode: useful as an optional escape hatch after the default workspace improves. It should not become a workaround for poor defaults.
- Better default split ratios: the first useful document state should give editor/preview content a comfortable width and height on common laptops, with upload/session controls reachable but not dominant.
- Broader visual redesign: optional only if measured, targeted changes still fail to make the workspace feel clear and roomy. A redesign must not be used as a vague substitute for fixing document-area allocation.

Pros and cons:

- Targeted layout improvements preserve KISS/SRP/YAGNI, keep the shared shell recognizable, reduce implementation risk, and can be verified with viewport screenshots and simple measurements. The risk is local patchwork if each row is compacted without a coherent document-first rule.
- A broader visual redesign could reset hierarchy and remove accumulated chrome in one pass. The cost is high: larger review surface, more accessibility regression risk, more Mac/browser boundary risk, and a greater chance of changing style while dodging the actual working-area problem.

Before considering a full redesign, achieve and verify:

- working mode has a clear document-first allocation rule
- default sidebar width/collapse behavior and preview/editor height work at common laptop sizes without repeated resizing
- primary controls remain reachable through compact placement, not through extra vertical rows
- preview, edit, and LinkedIn modes preserve useful scroll/context when switching without reserving unnecessary chrome
- before/after validation measures the editor/preview content rectangle, not just the total preview panel or the whole app shell
- resize handles remain keyboard-accessible, visible enough, and resettable without native `title` tooltips
- no regression against `docs/accessibility-notes.md`
- no regression to Mac shell behavior from PR #138: external links still leave the desktop shell, and desktop-only actions stay native where appropriate

Acceptance:

- In working mode, editor/preview content receives the dominant share of viewport height at common laptop sizes, not only on large desktop monitors.
- The first loaded or pasted document opens into a comfortable editor/preview workspace without repeated manual resizing.
- At 1280x800 and 1440x900, future implementation validation records before/after screenshots or measurements for the actual editable/rendered content rectangle and shows that space above the workspace no longer dominates the first working view.
- Primary controls for New/Open, Save, Find, mode switching, Copy, sidebar show/hide, and resize/reset stay reachable without occupying excessive vertical space.
- Default panel sizing gives document content the priority over upload/session chrome while keeping session context recoverable.
- Preview and edit modes preserve useful context during mode switches without using fixed chrome as a crutch.
- The layout feels less cramped at 1280px-wide and 1440px-wide laptop viewports because the document area is visibly larger, not because decorative chrome was restyled.
- Narrow tablet behavior is coordinated with the mobile/tablet item rather than solved through accidental desktop shrinkage.

Out of scope unless evidence justifies it:

- a full visual redesign of the whole app
- a new design system or token rewrite
- a new editor engine
- command palette, shortcut remapping, or IDE-style panels
- source-tree file operations or folder workspace scope
- `@doc2md/core` API/CLI changes
- hiding required controls so aggressively that keyboard, screen-reader, or low-vision users lose the current accessibility contract

### Theme parity audit

Surfaces: Hosted, Mac.

Gut: `need`.

The app has explicit light and dark theme tokens, and the Mac persistence store already knows about theme values. The missing piece is confidence: every primary surface should be checked in both themes, including working mode, landing mode, file list rows, preview highlights, LinkedIn preview, find/replace, disabled links, recent-file menus, save/error pills, and resize handles.

Keep the scope boring:

- no new theme architecture
- no new color palette
- no automatic system theme until parity is verified
- no visual redesign

Acceptance:

- A reviewer can run the hosted and Mac app in light and dark mode and see no unreadable text, invisible focus ring, or color-only status.
- Find highlights remain legible in all three modes: Edit, Preview, LinkedIn.
- Error, warning, success, disabled, selected, and focus states are distinct in both themes.

### Mobile and tablet layout pass

Surfaces: Hosted.

Gut: `need`.

The hosted app is used in a browser, so mobile and tablet behavior are part of the product. The current responsive rules exist, but the product needs a first-class pass for phones, narrow tablets, and iPad split view.

Keep it focused:

- phone: upload/open, start writing, edit, preview, save/download, copy
- tablet: stacked workspace, mode switcher reachability, sidebar collapse behavior
- touch: no hover-only affordances, 44px preferred targets, no hidden primary action behind a keyboard
- browser chrome: use dynamic viewport units and safe-area padding where relevant

Acceptance:

- At 375px, a user can start a draft, paste content, switch modes, save/download, and recover from an error without horizontal scroll.
- At 768px, workspace stacking feels intentional rather than like a squeezed desktop.
- The software keyboard does not cover the editor's active input or the Save action.

### Performance perception pass

Surfaces: Hosted, Mac, Core.

Gut: `need`.

Performance is already partly handled: find caps highlights at 5000 matches, conversion has timeouts, and save states are visible. The next pass is about perception and honesty, not raw speed.

Hosted and Mac:

- show no spinner for sub-300ms work
- show a shaped loading state for conversion work that crosses the visible threshold
- show real progress only where progress is real
- keep large paste promotion and find/replace responsive
- do not animate high-frequency editor actions

Core:

- keep `durationMs`, `status`, `warnings`, and `error` useful and stable
- make CLI batch progress understandable without noisy live dashboards
- never hide skipped/unsupported inputs in aggregate summaries

Acceptance:

- A large local conversion tells the user that conversion is happening locally and does not imply network upload.
- A timeout or unsupported file explains the next action.
- CLI users can tell which inputs succeeded, skipped, or failed without opening every output file.

### Onboarding clarity

Surfaces: Hosted, Mac, Core.

Gut: `need`.

First-run copy should answer one question: "What can I do now?" Avoid architecture lectures in the UI. The hosted app and Mac app can still say files stay local, but only where it reduces anxiety or helps the decision to drop a document.

Hosted:

- landing mode should keep the private-conversion promise
- the first visible actions should be Start writing, Open/drop files, and Install only where relevant
- mobile first-run should avoid a giant hero that pushes the task below the fold

Mac:

- working mode should feel like a document workspace, not a browser page
- desktop-only capabilities belong in native menus or compact desktop controls
- external web/download references must open outside the shell

Core:

- README examples should lead with the simplest successful CLI and API paths
- local tarball/public npm caveats should stay accurate without burying the first command

Acceptance:

- A first-time user can scan only headings, button labels, and first sentences and know how to convert or start writing.
- The Mac app does not present browser-download actions that cannot work in the bundle.
- Mac copy and labels avoid browser verbs such as "open in tab" or "download page"; any external web/download references open outside the shell.
- Core docs distinguish local files, remote URLs, output directory, and batch limits without making users infer the contract.

### Empty-state copy pass

Surfaces: Hosted, Mac, Core.

Gut: `need`.

Empty states should teach the next action at the moment the user needs it. Existing copy is close, but this should be audited as a product surface.

Targets:

- no files/drafts in the left rail
- empty preview before content exists
- no recent files
- empty converted output
- empty batch result in Core/CLI

Acceptance:

- Every empty state names what belongs there and the exact action that fills it.
- No empty state is just "empty" or purely decorative.
- Empty-state copy remains one short sentence unless a second sentence is doing real work.

### Error-state copy pass

Surfaces: Hosted, Mac, Core.

Gut: `need`.

doc2md already has better-than-generic conversion messages. The next pass should make every user-facing error follow the same standard: what happened, why if known, what to do next.

Targets:

- unsupported file
- empty file
- corrupt/unreadable file
- scanned PDF
- low-quality PDF
- timeout
- remote URL failure
- native open/save/reload/reveal failures
- save conflict
- Core batch failure and skipped input summaries

Acceptance:

- No user-facing error says only "Something went wrong."
- No raw stack trace or implementation code leaks into UI copy.
- Save conflicts and reload failures preserve user control instead of sounding final.

### Copy-paste UX loop

Surfaces: Hosted, Mac, Core if needed.

Gut: `need` for Hosted/Mac, `if-needed` for Core.

Paste-to-Markdown has shipped, and copy-to-clipboard already exists in preview surfaces. The remaining work is to make the loop feel intentional:

- paste rich text or LinkedIn-ish content into the editor
- see that it became Markdown
- copy Markdown or LinkedIn text deliberately
- know when copy succeeded
- keep the editor focused where appropriate

Scope:

- improve labels, affordances, and success feedback around existing copy/paste paths
- consider "Copy Markdown" and "Copy LinkedIn text" buttons near the mode switcher if they do not clutter the toolbar
- do not add a clipboard history
- do not add background paste transforms outside explicit paste handling
- do not change `@doc2md/core` unless a real script/CLI paste use case appears

Acceptance:

- A user can round-trip from pasted rich text to editable Markdown and copied output without guessing which mode owns the copy button.
- Copy feedback is visible and screen-reader reachable.
- Paste transformation never silently rewrites existing content outside the user's paste target.

### Keyboard discoverability

Surfaces: Hosted, Mac.

Gut: `need`.

This revives Phase 6e with the YAGNI-reduced scope from `ideas/mac-desktop-app-roadmap.md`: a compact reference for shortcuts that already exist.

Include only real, supported shortcuts:

- Save
- Find
- Find with Replace expanded
- Bold / Italic / Link
- Ordered / unordered / task list toggles
- mode switch behavior only if a shortcut exists
- close/dismiss behavior such as Escape where it already exists

Do not build:

- command palette
- remapping UI
- searchable help center
- onboarding tour
- a list of aspirational shortcuts

Acceptance:

- The reference is reachable from a compact Help or `?` affordance.
- Hosted and Mac copies differ only where the platform shortcuts differ.
- No listed shortcut is fictional.

### Lightweight accessibility audit

Surfaces: Hosted, Mac, Core docs.

Gut: `need`.

This revives Phase 6f with the same YAGNI boundary: a lightweight audit of existing primary controls, not a certification project.

Audit:

- upload/open
- start writing/new
- edit textarea
- mode switcher
- save/download
- find/replace
- copy
- recent menu
- sidebar show/hide and resize controls
- close/dismiss controls
- conversion, save, and error status announcements
- before-unload unsaved-change guard behavior

Core has no UI surface, but its docs and CLI output still need accessible plain-language structure: headings, copy-pasteable commands, and status wording that works in screen readers and terminal logs.

Acceptance:

- Keyboard-only users can complete the primary hosted and Mac workflows.
- Icon-only buttons have accessible names.
- Status changes are announced where they matter and quiet where they would be noise.
- No regressions against the `docs/accessibility-notes.md` baseline items: save status semantics, find bar semantics, editor keyboard contract, recent menu behavior, and before-unload guard.
- Lighthouse accessibility does not materially regress for the hosted app.

### Custom tooltip cleanup

Surfaces: Hosted, Mac.

Gut: `need`.

User-facing hint tooltips should use the instant custom pattern. Native HTML `title` hints are slow, OS-styled, and inconsistent with the existing tooltip system.

Scope:

- replace user-facing `title=` hints on controls, recent files, resize handles, and working-mode controls with custom `role="tooltip"` siblings or equivalent accessible patterns
- keep non-user-facing metadata titles only if they are not acting as interaction hints
- keep every tooltip reachable by hover and focus
- preserve `aria-describedby`

Acceptance:

- No user-facing control relies on native `title` for its only explanation.
- Tooltip text is still available to assistive tech.
- Touch users are not blocked by hover-only hints.

## If-needed items

### Block move and select next occurrence

Surfaces: Hosted, Mac.

Gut: `if-needed`.

This is the unshipped tail of the archived hardening proposal:

- Alt-Up / Alt-Down moves the current line or selected block.
- Cmd-D selects the next occurrence.

These are useful editor muscle-memory bindings, but the current textarea has stayed valuable because it is simple, accessible, and low-bundle-weight. Ship these only if:

- the implementation is small and well-tested on the current textarea, or
- an editor-engine evaluation independently decides to move to CodeMirror/ProseMirror for broader reasons.

Acceptance if revived:

- Works with selections, single lines, and undo.
- Does not fire during IME composition.
- Does not steal platform shortcuts in text fields.
- Has tests for Mac and non-Mac modifier behavior.

### Folder view as local workspace

Surfaces: Hosted, Mac.

Gut: `if-needed`.

`ideas/doc2md-folder-view.md` remains the right tracker. The value is real: Active/Folder tabs would make doc2md feel more like a local Markdown workspace. The risk is also real: browser File System Access API, Mac directory selection, tree UI, unsupported-file hints, persistence, and deduping all arrive together.

Trigger:

- explicit product shift toward "doc2md is your local markdown workspace", or
- repeated user pain around browsing multiple source documents.

Keep the non-negotiable:

- never auto-convert a folder
- never write source files
- source-tree file operations stay out of scope

### Browser crash recovery

Surfaces: Hosted.

Gut: `if-needed`.

`ideas/doc2md-browser-crash-recovery.md` remains the right tracker. The hosted app already has in-session protection and a before-unload guard. Reload-surviving drafts need stable identity, an index, localStorage/IndexedDB behavior, and recovery UI.

Trigger:

- a real user loses meaningful work, or
- hosted web becomes a stronger draft-authoring workspace.

### Hosted scratch-buffer preservation

Surfaces: Hosted.

Gut: `if-needed`.

This is the Phase 6g parked item: a session-local scratch buffer so refresh or accidental navigation does not erase unsaved hosted-browser work. It is smaller than full browser crash recovery, but it should still wait for the same trigger family because it introduces draft identity and recovery UI.

Acceptance if revived:

- Preserve unsaved scratch content across reload within the same browser profile.
- Show a clear Restore / Discard choice before repopulating the editor.
- Do not persist source file paths.
- Do not change Core or Mac save semantics.

### Mac file watchers

Surfaces: Mac.

Gut: `if-needed`.

`ideas/doc2md-mac-file-watchers.md` remains the right tracker. Save-time and reload-time mtime checks catch the common conflict. Live `NSFilePresenter` / `NSFileCoordinator` work waits for a real iCloud, Dropbox, or OneDrive conflict report.

Trigger:

- user reports a silent overwrite or confusing conflict while editing from a synced folder.

### System theme follow

Surfaces: Hosted, Mac.

Gut: `if-needed`.

After theme parity is proven, the app can consider following system light/dark settings. Do not do this first. Parity without automatic switching is useful. Automatic switching without parity is just a faster way to show broken states.

Acceptance if revived:

- explicit user choice beats system default
- Mac persistence and hosted persistence stay separate
- no flicker on first paint

## YAGNI list

Do not build these as part of this transformation:

- full visual redesign unless the workspace real-estate acceptance criteria prove targeted work is insufficient
- command palette
- configurable shortcut remapping
- vim/emacs modes
- slash commands
- AI-assisted writing inside the editor
- source-tree rename/move/delete
- two-way sync with folders
- formal WCAG certification matrix
- `@doc2md/core` interactive TUI

These may become reasonable later, but none is needed for the current north-star.

## Breaking change rationale

No breaking changes are proposed in this document.

Current non-breaking rationale:

- Hosted: UX-only roadmap items, no persisted-data contract change.
- Mac: shell behavior preserved, and the external-link policy remains unchanged.
- Core: no API, CLI option, or result-shape changes.

Future breaking changes must add a dedicated block with:

- affected surface: Hosted, Mac, Core, or multiple
- exact behavior/API being broken
- migration path
- why a non-breaking path is worse
- reviewer-visible debate notes

Examples that would require this block:

- changing `@doc2md/core` result shapes or option names
- removing remote URL inputs from Core
- changing save semantics for converted source documents
- changing default hosted behavior in a way that loses user data
- making desktop links open inside the shell

## Suggested order

1. Workspace real-estate and working-area density. Make working mode document-first before polishing surrounding surfaces.
2. Theme parity audit plus custom tooltip cleanup. Same visual QA pass, small code surface when implemented.
3. Mobile/tablet layout pass for the hosted app. Related to workspace density, but focused on touch and narrow responsive behavior.
4. Error and empty-state copy pass across Hosted, Mac, and Core. Cheap, high clarity.
5. Performance perception pass. Keep it honest and bounded.
6. Keyboard discoverability and lightweight a11y audit. The shortcut list and a11y pass should reference the same real controls.
7. Copy-paste UX loop polish. Keep it near the mode switcher if it earns the pixels.
8. Reconsider `if-needed` items only after a concrete trigger lands.

## Validation expectations for future implementation quests

Each implementation quest should name which surfaces it touches and which score justified it.

Minimum validation by surface:

- Hosted: unit tests where logic changes, Playwright or manual screenshots at 375px, 768px, 1280px, and light/dark where relevant.
- Mac: Swift tests for shell behavior, React tests for shared UI, and a manual smoke on a local `.app` when native behavior changes.
- Core: unit tests for API/CLI behavior, README examples kept copy-pasteable, and no public contract break unless the breaking-change block was approved.

Done means the product feels clearer, not bigger.
