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
- `shipped`: implemented and kept here as roadmap history; do not schedule as
  active work unless a regression or new trigger reopens it.

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
| Onboarding clarity | yes | yes | yes | `shipped` | Completed in PR #144; first-run copy now makes the user's next action obvious without restating the architecture. |
| Empty-state copy pass | yes | yes | yes | `shipped` | Completed in PR #144; empty states now name the action that fills them. |
| Error-state copy pass | yes | yes | yes | `shipped` | Completed in PR #144; errors now say what happened, why if known, and what the user can do next. |
| Copy-paste UX loop | yes | yes | if needed | `need` Hosted/Mac, `if-needed` Core | Paste-to-Markdown has shipped; now the product should make paste, copy Markdown, and copy LinkedIn feel intentional and discoverable. Core remains if-needed until a concrete CLI/script paste workflow exists. |
| Keyboard discoverability | yes | yes | n/a | `need` | Enough real shortcuts now exist to justify a compact reference. No command palette, remapping UI, or aspirational shortcut list. |
| Lightweight a11y audit | if needed | if needed | no | `if-needed` | Not part of the Step 5 keyboard-discoverability slice. Keep `docs/accessibility-notes.md` as the baseline contract, and revive broader audit work only with a concrete accessibility trigger. |
| Custom tooltip cleanup | yes | yes | n/a | `need` | Native `title` tooltips are too slow and inconsistent. Existing `title=` uses should be replaced where they are user-facing hints. |
| Block move and select next occurrence | yes | yes | n/a | `if-needed` | Useful editor muscle memory, but only worth shipping if the textarea implementation stays simple or the editor engine changes for other reasons. |
| Folder view as local workspace | if needed | if needed | n/a | `if-needed` | Real workspace value, but still a larger positioning move toward "local markdown workspace". |
| Browser crash recovery | if needed | n/a | n/a | `if-needed` | Valuable only after a real data-loss trigger or a broader hosted-workspace push. |
| Hosted scratch-buffer preservation | if needed | n/a | n/a | `if-needed` | Parked Phase 6g item: session-local scratch buffer so refresh or accidental navigation does not erase unsaved hosted-browser work. |
| Mac file watchers | n/a | if needed | n/a | `if-needed` | Save-time mtime checks already catch the common case. Live watchers wait for a real iCloud/Dropbox conflict report. |
| System theme follow | if needed | if needed | n/a | `if-needed` | Useful after parity is proven. Do parity first; automatic system sync can wait. |
| sketch2md cross-product discovery | if needed | if needed | n/a | `if-needed` | Wait until sketch2md is launched. Crosslinks may help users understand the product suite later, but they should not add chrome to active document workspaces before that launch. |
| Command palette / shortcut remapping | no | no | n/a | `yagni` | Too much product surface for today's app. A compact reference solves discoverability without building an IDE. |
| Formal WCAG certification matrix | no | no | n/a | `yagni` | Certification-level work, Lighthouse targets, and screen-reader audit matrices are not proportional today. |
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
- WCAG audit, certification matrix, Lighthouse target, screen-reader audit, or broad focus-ring redesign

Acceptance:

- The reference is reachable from a compact Help or `?` affordance.
- Hosted and Mac copies differ only where the platform shortcuts differ.
- No listed shortcut is fictional.

### Lightweight accessibility audit

Surfaces: Hosted, Mac, Core docs.

Gut: `if-needed`.

This is explicitly outside the Step 5 keyboard-discoverability slice. Keep
`docs/accessibility-notes.md` as the baseline contract for existing editor,
find/replace, recent-menu, resize-handle, save, and before-unload behavior.
Revive audit work only as a separate proposal with a concrete trigger.

Do not bundle into Step 5:

- WCAG audit, matrix, or certification
- Lighthouse accessibility scoring or targets
- screen-reader testing or compliance claims
- broad focus-ring redesign
- Core docs accessibility audit
- command palette, shortcut remapping, or new editor engine

If a later audit is revived, start from real controls and the current
accessibility notes rather than from a compliance checklist.

Acceptance:

- Step 5 preserves the `docs/accessibility-notes.md` baseline items while adding shortcut discoverability.
- Any future audit has its own scoped prompt, validation, and PR.

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

`ideas/doc2md-browser-crash-recovery.md` remains the right tracker. It is not
shipped for hosted-browser reload survival. The hosted app already has
in-session protection and a before-unload guard, and the Mac app has separate
session restore; those shipped protections are easy to confuse with this idea.
Reload-surviving hosted drafts still need stable identity, an index,
localStorage/IndexedDB behavior, and recovery UI.

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

### sketch2md cross-product discovery

Surfaces: Hosted, Mac.

Gut: `if-needed`.

Do not add sketch2md links or analytics to product UI yet. sketch2md is not
launched, so cross-product discovery would be premature and would add noise to
the current doc2md workspace.

Trigger:

- sketch2md is publicly launched and ready to receive doc2md users, and
- there is an explicit product decision that doc2md and sketch2md should be
  presented as related tools.

Acceptance if revived:

- Link only to a live, useful sketch2md destination.
- Prefer low-interruption surfaces first: landing, help/about, footer-level
  resources, or an empty/onboarding state.
- Do not add cross-product links to `WorkingModeBar` or other active
  document-workspace chrome unless validation shows users need that shortcut
  while editing.
- If analytics are added, use an allowlisted payload and make click tracking
  best-effort so outbound navigation is never blocked.

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
6. Keyboard discoverability. The shortcut list should reference only real, already-supported editor/workspace shortcuts.
7. Copy-paste UX loop polish. Keep it near the mode switcher if it earns the pixels.
8. Reconsider `if-needed` items only after a concrete trigger lands.

## Execution roadmap

This is the runbook for turning the `need` items above into reviewable PRs.
It uses the team's current execution vocabulary:

- `/goal`: create a durable objective before a multi-PR sequence.
- `just do it`: direct implementation by the current agent, best for narrow copy or docs/code cleanup.
- `quest:solo`: one-agent Quest execution for focused UI work with bounded file scope.
- `quest:workflow`: full Quest workflow for broad cross-surface changes.
- `pr-assist` / `pr-assistant`: create or update the draft PR with an explicit validation section.
- `pr-shepherd`: push, follow CI and review comments, then mark ready when clean.

Trust contract for every PR:

- Do not ask Kjell to approve plans for these roadmap items. Use repo auto
  approvals where available, keep the implementation plan in artifacts or PR
  notes, and ask Kjell only to validate the resulting PR behavior.
- If a Quest runner enforces a non-optional implementation gate, pause once
  with the exact gate name and the smallest possible approval request. Do not
  ask for plan approval.
- Each PR starts from current `main` on a fresh branch and keeps one reviewable
  product slice.
- Each PR body includes a "Kjell validation" checkbox with the exact manual
  behavior to inspect.
- `pr-shepherd` may fix CI and review comments autonomously. It should not mark
  ready while CI is failing or while unresolved review comments remain.

Already settled before execution:

- `ci-trustworthiness` is shipped and archived. Do not run it as an active UX
  roadmap item.
- `doc2md-browser-crash-recovery` is still open only for hosted
  reload-surviving drafts. Do not count Mac session restore or the hosted
  `beforeunload` guard as completion.
- sketch2md cross-product discovery is deferred until sketch2md has launched.
  Do not add links, analytics, CSS, or React UI for it in the current execution
  sequence.
- Step 4, onboarding/empty/error-state copy, is complete in PR #144. Do not
  schedule it again unless a regression or new copy surface reopens the need.
- Step 4 validation surfaced two pre-existing Fast Refresh lint warnings in
  `src/shell/desktopAdapter.tsx` for `DesktopMenuBridge` and
  `DesktopMenuEventBridge` living in the adapter module. They are non-blocking
  for production behavior and should be handled as a small desktop-shell cleanup
  by moving those bridge components into a component-only module when the
  desktop shell is next touched.

| Step | Scope | Tool path | Order | Parallel rule | Kjell validation |
|---:|---|---|---|---|---|
| 0 | Open the multi-PR objective and confirm current idea status | `/goal` | First | Must run first | Confirm the roadmap order still matches priority. |
| 1 | Workspace real-estate and working-area density | `quest:workflow` -> `pr-assist`/`pr-assistant` -> `pr-shepherd` | Sequential backbone | Do not run other layout/theme/mobile UI PRs in parallel. | Compare 1280x800 and 1440x900 working-mode screenshots; editor/preview content should visibly own more of the viewport without hiding primary controls. |
| 2 | Theme parity audit plus custom tooltip cleanup | `quest:solo` -> `pr-assist`/`pr-assistant` -> `pr-shepherd` | After step 1 | Do not overlap with mobile layout unless write scopes are explicitly split. | Inspect light/dark editor, preview, errors, disabled states, and tooltip hints. |
| 3 | Mobile and tablet layout pass | `quest:workflow` -> `pr-assist`/`pr-assistant` -> `pr-shepherd` | After step 1; preferably after step 2 | Do not overlap with step 1. | Inspect hosted app at 375px and 768px; controls should fit, touch targets should be usable, no text overlap. |
| 4 | Onboarding, empty-state, and error-state copy pass | Complete in PR #144 | Done | Do not rerun unless reopened by regression or a new copy surface. | Read first-run, empty, and failure states; each should name the next useful action without adding architecture lectures. |
| 5 | Keyboard shortcut discoverability | `quest:solo` -> `pr-assist`/`pr-assistant` -> `pr-shepherd` | After step 1 | Avoid parallel edits to the same toolbar/menu files as step 2. | Use the shortcut reference and a keyboard smoke walkthrough; shortcut claims should match real controls. |
| 6 | Performance perception pass | `quest:workflow` -> `pr-assist`/`pr-assistant` -> `pr-shepherd` | After PR #144 copy language | Sequential with copy-paste polish if both touch status messaging. | Convert, search, paste, and batch output should show honest progress or bounded wait states. |
| 7 | Copy-paste UX loop polish | `quest:solo` -> `pr-assist`/`pr-assistant` -> `pr-shepherd` | After step 1 and PR #144 | Can run after performance pass or in parallel only if write scopes avoid status/progress components. | Paste Markdown/HTML, copy Markdown, and copy LinkedIn output; actions should be discoverable and not add excess chrome. |
| 8 | Revisit `if-needed` items: folder view, browser crash recovery, scratch-buffer preservation, Mac file watchers, system theme follow, sketch2md cross-product discovery | `quest:workflow` -> `pr-assist`/`pr-assistant` -> `pr-shepherd` | Only after a trigger lands | Not part of the default parallel pool. Treat each as its own proposal. | Validate against the trigger that revived the item, not against speculative acceptance. |

### Prompt pack

Use these prompts as written, replacing `<branch-suffix>` only when the
executor needs a branch name.

#### Step 0 prompt

```text
/goal "Execute the doc2md UX transformation roadmap with high trust. Work from current main, keep each PR focused, do not ask Kjell to approve plans, and ask Kjell to validate the result of each ready PR. Treat ci-trustworthiness as shipped/archived and doc2md-browser-crash-recovery as still open only for hosted reload-surviving drafts."
```

#### Step 1 prompt

```text
quest:workflow
Implement doc2md UX transformation step 1: workspace real-estate and working-area density.

Read ideas/ux-transformation.md sections "Workspace real-estate and working-area density", "Execution roadmap", and "Validation expectations for future implementation quests". Start from current main on a fresh branch named like ux/workspace-density-<branch-suffix>.

Trust mode: do not ask Kjell to approve a plan. Keep the plan in Quest artifacts or PR notes. If the runner enforces a non-optional implementation gate, pause once with the exact gate name and the smallest approval request. Ask Kjell only to validate the resulting PR behavior.

Scope: make working mode document-first for Hosted and Mac shared React surfaces. Preserve Mac desktop link routing, save/reload behavior, beforeunload behavior, accessibility notes, and Core API/CLI behavior. Do not build a new design system, command palette, editor engine, folder view, or crash recovery layer.

Validation required before PR: run relevant unit/component tests, run hosted visual checks at 1280x800 and 1440x900, and capture before/after evidence for the actual editor/preview content rectangle. Then run pr-assist to create a draft PR whose validation section asks Kjell to compare those working-mode screenshots and confirm primary controls remain reachable. Run pr-shepherd until CI and review comments are clean, then mark ready for Kjell validation.
```

#### Step 2 prompt

```text
quest:solo
Implement doc2md UX transformation step 2: theme parity audit plus custom tooltip cleanup.

Read ideas/ux-transformation.md sections "Theme parity audit", "Custom tooltip cleanup", "Execution roadmap", and "Validation expectations for future implementation quests". Start from current main on a fresh branch named like ux/theme-tooltip-parity-<branch-suffix>.

Trust mode: do not ask Kjell to approve a plan. Keep the plan brief and execute. Ask Kjell only to validate the resulting PR behavior.

Scope: audit and fix light/dark parity across editor, preview, highlights, errors, empty states, menus, disabled states, and user-facing hints. Replace user-facing native title tooltips with the project's instant custom tooltip pattern using role="tooltip" and aria-describedby. Avoid broad restyling and do not change layout density, mobile behavior, Core conversion behavior, or Mac link routing.

Validation required before PR: run relevant tests, inspect light and dark states for the touched surfaces, and include a PR validation checkbox asking Kjell to inspect theme parity and tooltip timing. Then run pr-assist for a draft PR and pr-shepherd until CI and review comments are clean.
```

#### Step 3 prompt

```text
quest:workflow
Implement doc2md UX transformation step 3: hosted mobile and tablet layout pass.

Read ideas/ux-transformation.md sections "Mobile and tablet layout pass", "Execution roadmap", and "Validation expectations for future implementation quests". Start from current main on a fresh branch named like ux/mobile-tablet-layout-<branch-suffix>.

Trust mode: do not ask Kjell to approve a plan. Ask Kjell only to validate the ready PR result.

Scope: improve hosted app behavior at 375px and 768px without changing Core, Mac-native shell behavior, or desktop workspace priorities from step 1. Controls must fit, touch targets should be usable, text must not overlap, and the first useful action should stay visible.

Validation required before PR: run relevant unit/component tests plus Playwright or browser screenshots at 375px and 768px in light/dark where touched. Use pr-assist to create a draft PR with a Kjell validation checkbox for phone/tablet screenshots, then run pr-shepherd until clean and ready.
```

#### Step 4

Completed in PR #144. Do not rerun this prompt as active roadmap work unless a
regression or new copy surface reopens the need.

#### Step 5 prompt

```text
quest:solo
Implement doc2md UX transformation step 5: keyboard shortcut discoverability.

Read ideas/ux-transformation.md sections "Keyboard discoverability", "Lightweight accessibility audit", "Execution roadmap", and docs/accessibility-notes.md. Start from current main on a fresh branch named like ux/keyboard-shortcuts-<branch-suffix>.

Trust mode: do not ask Kjell to approve a plan. Ask Kjell only to validate the resulting PR behavior.

Scope: add or refine a compact shortcut reference for real, already-supported editor/workspace shortcuts. Include only typical editor shortcuts that actually exist, such as Save, Find, Find with Replace expanded, Bold, Italic, Link, ordered/unordered/task list toggles, Escape close/dismiss, and mode-switch behavior only if a real shortcut exists. Preserve existing keyboard contracts documented in docs/accessibility-notes.md, especially editor shortcuts, find/replace behavior, recent menu keyboard behavior, resize handle keyboard behavior, and before-unload behavior.

Hard out of scope: WCAG audit, WCAG matrix, certification, Lighthouse accessibility target, screen-reader audit, command palette, shortcut remapping/settings, new editor engine, broad focus-ring redesign, Core API/CLI behavior changes, and performance/status messaging changes.

Validation required before PR: run relevant unit/component tests, verify each displayed shortcut against the actual code path, and do a keyboard smoke walkthrough for the listed shortcuts and existing dismiss/menu behavior. Use pr-assist to create a draft PR with a Kjell validation checkbox for shortcut reference accuracy and keyboard walkthrough, then run pr-shepherd until clean and ready.
```

#### Step 6 prompt

```text
quest:workflow
Implement doc2md UX transformation step 6: performance perception pass.

Read ideas/ux-transformation.md sections "Performance perception pass", "Execution roadmap", and "Validation expectations for future implementation quests". Start from current main on a fresh branch named like ux/performance-perception-<branch-suffix>.

Trust mode: do not ask Kjell to approve a plan. Ask Kjell only to validate the resulting PR behavior.

Scope: make conversion, search, paste, batch output, and remote fetch feel honest and bounded through existing status surfaces. Add progress or waiting feedback only where work can actually take long enough to matter. Do not add fake precision, new background infrastructure, or broad telemetry.

Validation required before PR: run relevant tests and manually exercise conversion, search, paste, batch output, and remote fetch paths where available. Use pr-assist to create a draft PR with a Kjell validation checkbox for perceived progress and wait-state honesty, then run pr-shepherd until clean and ready.
```

#### Step 7 prompt

```text
quest:solo
Implement doc2md UX transformation step 7: copy-paste UX loop polish.

Read ideas/ux-transformation.md sections "Copy-paste UX loop", "Execution roadmap", and current paste/copy implementation. Start from current main on a fresh branch named like ux/copy-paste-loop-<branch-suffix>.

Trust mode: do not ask Kjell to approve a plan. Ask Kjell only to validate the resulting PR behavior.

Scope: make paste, copy Markdown, and copy LinkedIn output feel intentional and discoverable without adding excess chrome. Preserve shipped paste-to-Markdown behavior, LinkedIn output behavior, and Core contracts unless a concrete Core workflow justifies otherwise.

Validation required before PR: test paste Markdown/HTML, copy Markdown, and copy LinkedIn output in the touched surfaces. Use pr-assist to create a draft PR with a Kjell validation checkbox for the copy-paste walkthrough, then run pr-shepherd until clean and ready.
```

#### Step 8 prompt template

```text
quest:workflow
Revive the if-needed item <idea-name> from ideas/ux-transformation.md because this concrete trigger landed: <trigger>.

Before planning, validate the trigger against current code and current user evidence. If the trigger does not hold, update the idea instead of implementing it.

Trust mode: do not ask Kjell to approve a plan unless the Quest runner enforces a non-optional implementation gate. Ask Kjell only to validate the resulting PR behavior against the trigger.

Scope: implement only the acceptance criteria needed for the trigger. Use pr-assist for a draft PR with trigger-specific Kjell validation, then run pr-shepherd until clean and ready.
```

## Validation expectations for future implementation quests

Each implementation quest should name which surfaces it touches and which score justified it.

Minimum validation by surface:

- Hosted: unit tests where logic changes, Playwright or manual screenshots at 375px, 768px, 1280px, and light/dark where relevant.
- Mac: Swift tests for shell behavior, React tests for shared UI, and a manual smoke on a local `.app` when native behavior changes.
- Core: unit tests for API/CLI behavior, README examples kept copy-pasteable, and no public contract break unless the breaking-change block was approved.

Done means the product feels clearer, not bigger.
