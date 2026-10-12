---
title: doc2md UX handoff and deferred decisions
purpose: Preserve Impeccable setup, critique results, and the decisions needed to resume work.
status: Approved scope complete; deferred decisions remain
last_updated: 2026-10-12
---

# doc2md UX handoff and deferred decisions

Impeccable initialization and the first independent design critique are complete. The user approved the focused scope below by replying “continue” to the explicit proposal. The three approved refinements are implemented; do not repeat initialization or the critique.

## Confirmed direction

- Scope is the shared doc2md product at the repository root, covering the web and Mac apps.
- Keep the existing focus: people entering AI-assisted workflows need straightforward local document conversion into editable Markdown.
- The web app and DMG app are mature, functional, and have undergone several improvement rounds. The goal is broader appeal and a natural, approachable experience while preserving reliable workflows.
- The size of changes should follow evidence. The user has not requested a wholesale redesign.
- **Code-first is the confirmed workflow.** An earlier comp-first choice was reconsidered and superseded. `.impeccable/config.json` records `"buildPath": "code"`.
- The user explicitly authorized sub-agents and expressed a standing preference: “you can use and always should use sub-agents when it makes sense.” Do not ask again merely to repeat this authorization. Applicable workflow gates still apply.

## Saved artifacts and branch state

Working branch: `chore/impeccable-init`.

| Artifact | Purpose |
|---|---|
| [PRODUCT.md](../../PRODUCT.md) | Shared product truth, audience, goals, constraints, and principles |
| [.impeccable/config.json](../../.impeccable/config.json) | Confirmed code-first default |
| [.impeccable/live/config.json](../../.impeccable/live/config.json) | Web live-mode configuration targeting `index.html`; CSP detection returned no policy |
| [Archived critique](../../.impeccable/critique/2026-10-10T01-09-55Z__src-shell-appshell-tsx.md) | Full first critique, heuristic scores, source evidence, detector findings, and questions |

The critique filename uses UTC; its local session date is October 9 in America/Denver. Stable critique target: `src/shell/AppShell.tsx`; slug: `src-shell-appshell-tsx`.

At handoff, these setup/report files are local and uncommitted; no PR has been opened or pushed for this work. Preserve them. The approved application changes and regression tests are also local and uncommitted. No DESIGN.md was created, and no new visual direction was selected.

## Critique conclusion

Two isolated assessments were completed: a design/workflow review and a detector/browser-evidence review. Detector findings were withheld until the design assessment finished.

The recommendation is **focused refinement, preserving the existing identity**. Editorial typography, restrained color, local-processing reassurance, conversion warnings, shortcuts, batch operations, and direct editing/preview are strengths. The main problem is hierarchy and clarity around starting work and finishing it.

Heuristic score: **25/40**, first run with no trend. This is a design judgment, not a usability study, market-appeal measurement, or proof that the product is broken.

| Priority | Finding | Evidence and proposed direction |
|---|---|---|
| P1 | Clear immediately discards unsaved browser drafts | Reproduced with a disposable draft: typed content, saw Unsaved, clicked Clear, draft disappeared without confirmation or undo. Protect dirty drafts with explicit discard confirmation or recoverable close. `src/shell/webAdapter.tsx:398` |
| P2 | Starting a small draft leaves the introduction dominant | Hero and intake area remain; intro-collapse control was disabled for that draft. Enter the working layout on Start writing/New, retaining an easy return. `src/shell/AppShell.tsx:346`, `src/shell/webAdapter.tsx:413` |
| P2 | Browser Save and Download have overlapping behavior but different promises | Save initiates a download and later marks Saved; separate Markdown download uses the same mechanism. Clarify download/copy feedback in browser while preserving native Mac Save/Save As semantics. `src/shell/webAdapter.tsx:472` |
| P2 | Toolbar exposes too many specialty decisions at once | Eleven controls observed in new-draft view, including LinkedIn, line numbers, and multiple outputs. Group specialty functions without sacrificing shortcuts. `src/components/preview/PreviewToolbar.tsx:423` |
| P2 | First-use copy leads with technical inventory | Extensions and Markdown terminology require interpretation; Upload contradicts Nothing is uploaded. Prefer Open files, a short Markdown explanation, and outcome-led copy. `src/shell/AppShell.tsx:356` |

The first three items are the approved initial scope. LinkedIn remains in its existing position.

## Approved implementation scope

The user accepted this explicit proposal by replying “continue”:

1. Protect unsaved drafts from accidental clearing.
2. Focus the workspace when writing starts.
3. Clarify browser Save/Download behavior.
4. Leave LinkedIn placement unchanged until a later toolbar pass.

Toolbar reorganization and introductory-copy rewriting remain deferred. No further scope confirmation is needed for these three improvements.

The implementation uses a discard confirmation for dirty browser entries, the existing working layout for intentional draft creation, and one primary Markdown download action with truthful download-started feedback. Native Save/Save As semantics remain unchanged.

## Decisions made and implemented

- Clear asks for confirmation only when the targeted documents contain unsaved edits or a save/download is in progress. Cancel preserves documents and selection. Clean documents and untouched blank drafts clear without a prompt.
- Start writing/New immediately enters the existing working layout. The logo restores the introduction without closing documents, and the user can return to editing.
- Browser output has one primary **Download .md** action (**Download** on narrow screens; accessible name **Download Markdown**). The initial feedback included **Ready to download** and **Not downloaded**; the October 11 combined-toolbar decision removed those routine pills. Current feedback is **Preparing download** or **Download started**; unavailable output uses a disabled icon with a hover/focus explanation. The last state confirms a request, not a verified file on disk. HTML export stays separate.
- Browser output state belongs to each document. Switching documents or editing during a download cannot mark newer content as downloaded.
- Native Mac Save/Save As keeps its file-writing behavior. A review exposed a race where edits made during a pending save could be marked saved; success and cancellation now compare against the submitted content and retain newer edits as unsaved.
- Compact browser output remains readable at 14px and preserves the existing mobile toolbar geometry. LinkedIn and native Save labels remain unchanged.

## Deferred product decisions

These require a later scope choice, not another approval of the completed refinements:

1. Whether and how to group specialty toolbar controls, including LinkedIn and line numbers. Preserve useful shortcuts and frequent workflows.
2. Superseded on October 10: the user does not want a newcomer introduction. Explore an intuitive task-focused empty workspace instead; brief action labels and contextual feedback remain appropriate.
3. Whether broader visual changes are justified after observing people use the refined workflow. No new visual identity or wholesale redesign was selected.

## Implementation completion

See the [completion record](history/impeccable-focused-ux-2026-10-09.md) for delivered behavior, verification, and existing browser-test failures. The approved scope is complete. All 973 unit/integration tests passed, as did typecheck, lint (existing warnings), and both web builds. The expanded browser run had 106 passes, 7 skips, and 7 preexisting failures detailed in that record. Native Mac GUI smoke testing remains unperformed.

## Original critique evidence and limits

- Visually exercised desktop web empty state, disposable draft creation/editing, rendered View, Clear, and shortcut help using native Brave controls.
- Mobile and native Mac behavior were not exercised. Native persistence, licensing, imported-file conversion, and actual export were not validated during this critique. Mac-specific conclusions are source-based.
- No supported browser provider/script-injection API was available. Screenshots and accessibility trees were captured in the tool transcript; no screenshot files or user-visible detector overlays were produced.
- CLI detector ran successfully against `src`: 12 warnings, no errors. Eight were definite fixture/converter false positives, two conventional visual patterns, one cosmetic About callout candidate, and one width-animation performance candidate. No observed jank or broken shipped images was established.
- No critique ignore file existed.
- Dependencies were installed with `npm ci --ignore-scripts` to run the local app. No application tests were needed for the documentation-only changes.
- The critique Vite server at `http://127.0.0.1:4173/doc2md/` was stopped. No Impeccable overlay helper was started. The temporary report body was deleted.

## Resume procedure

1. Read this handoff, PRODUCT.md, the archived critique, and the implementation completion record in `history/` when present. Read AGENTS.md and discover repository-local skills as required.
2. Check branch/status and preserve all local uncommitted work. Do not repeat initialization or overwrite code-first.
3. Check the latest verification record. The approved scope is implemented; do not restart it or ask the answered scope questions again.
4. Native Mac GUI smoke testing remains a useful release check; React/bridge tests and the desktop bundle build do not substitute for running the installed app.
5. Subsequent toolbar/copy work needs a scope choice from the deferred list. If the user explicitly chooses Quest, follow its full workflow.

Suggested resume prompt:

> Read docs/implementation/impeccable-ux-handoff.md and its completion record. Preserve the implemented UX refinements, existing product identity, and code-first workflow. Continue from the recorded remaining work without repeating the critique.

## Final design-hook triage

All four flagged CSS declarations exist unchanged at HEAD `e8d4f21`. No additional UI change was made.

- `side-tab`, selected file: retained as an active-item cue.
- `side-tab`, Markdown blockquote: retained as conventional quotation styling.
- `side-tab`, About automation note: retained as an existing informational callout, consistent with preserving the current identity.
- The three border findings were suppressed using the CLI's narrowest available configuration scope for this rule: `side-tab` only in `src/styles/global.css`. This also suppresses future side-tab findings in that file; other rules remain active. The reason records agent judgment, not user confirmation.
- `layout-transition`, page-frame width: left standing, unsuppressed. It can cause layout work, but visible jank was not established. On October 10 the user explicitly chose to leave this animation unchanged unless it proves problematic. No suppression was added for that rule.

## October 10: comparison mockups requested

The user requested Impeccable recommendations and mockups for comparison, with no newcomer introduction. Width animation stays unchanged until there is evidence of a problem. This is design exploration, not approval to implement either candidate in the product. Compare a lighter existing toolbar with a flatter document workspace using the current palette and typography, realistic sample files, and the same modes. Preserve LinkedIn, batch operations, conversion warnings, Install & Use access, native Settings, and the distinction between Download and Save.

Comparison delivered: [interactive A/B mockup](../design/workspace-comparison/index.html), with empty/working, light/dark, web/Mac controls, plus [recommendations and integration boundaries](backlog/impeccable-workspace-options.md). That first recommendation was withdrawn after the user rejected both initial mockups on October 11; see the revision below. Both retain visible LinkedIn. Neither was selected at that stage; see the subsequent preference below. Neither has been implemented in the actual app. Local preview is served by Vite on port 4173 while this session is active.

## October 11: revised comparison after user screenshots

The user rejected the first mockups for unnecessary toolbar words and poor vertical economy, especially A. The existing app is the benchmark; the user had not yet selected a new layout at that point. Familiar toolbar actions now use icons with hover/focus tooltips and accessible names. Repeated workspace subtitles, forced title wrapping, the LinkedIn introduction, and promotional comparison framing were removed.

- **A — Document toolbar:** 52px app bar plus a 44px document toolbar on desktop.
- **B — Combined toolbar:** the same controls in one desktop app bar, saving one row. Below 980px, both use two compact rows.
- Both use the same 220px collapsible sidebar, sample content, typography, visible mode names, and compact conversion note.
- At 980px with LinkedIn, Find, and the warning visible, the first actual document text moved from approximately 533px to 204px in A and 415px to 160px in B, measured from the app frame top. These compare the rejected and revised prototypes, not the supplied native screenshots at different widths.
- Verified widths: 1440, 1050, 980, 768, 390, and 320px. Hover/focus tooltips, icon-only labels, HTML menu access, Escape, and New focus were exercised. At widths up to 360px, Find and Copy move into More tools so modes/output keep their touch targets without clipping.
- Fresh independent review accepted the revised supplied desktop/390px captures at prototype scope. The 320px fix also passed browser checks. Evidence: `docs/design/workspace-comparison/screenshots/revision-2/`. Earlier screenshot files remain historical.

Only the standalone mockup and design documentation changed during this revision; the earlier application implementation remains intact. No production layout change is approved. The unchanged width animation remains explicitly deferred. Current preview URL: `http://127.0.0.1:4173/doc2md/docs/design/workspace-comparison/index.html?concept=b&revision=2`. A reboot stops the local Vite process; restart with `npm run dev -- --host 127.0.0.1 --port 4173`. The HTML is self-contained and can also be opened from disk (clipboard permissions may differ).

## October 11: combined toolbar preferred; Settings revision

The user prefers B — Combined toolbar. The prototype now has a visible Settings gear in both variants. Settings contains Appearance (Day/Night) and a stable “Line numbers” checkbox, replacing the Show/Hide menu command. The Mac preview also contains a Persistence checkbox, reflecting the existing native feature; browser session persistence is not invented. Persistence remains a prototype preference and does not change native settings.

Verified Settings at 980, 390, and 320px in web and Mac previews: checkbox state survives reopening, appearance switches, Escape returns focus to the gear, and no horizontal page overflow. Desktop and mobile screenshots inspected in `docs/design/workspace-comparison/screenshots/settings/`. This records a prototype direction, not production implementation approval. Updated preview: `http://127.0.0.1:4173/doc2md/docs/design/workspace-comparison/index.html?concept=b&platform=mac&revision=3`.

Settings is accessed through the dedicated gear. Removed the duplicate Settings entry from More tools after user feedback; the ellipsis retains document actions and help.

Follow-up: the user found the adjacent gear and ellipsis redundant. Both prototypes now use a single gear popover combining preferences, secondary document actions, and help. The ellipsis is removed. Narrow-screen Find/Copy remain accessible in this combined popover.

## October 11: B approved and implemented

User explicitly approved production implementation and self-review. Shared combined toolbar, single grouped Settings, inline output/native document rename, responsive layout and preservation of existing save/conversion behavior implemented locally. See [completion record](history/combined-toolbar-2026-10-11.md) for validation and limitations. Preview the real web app at `http://127.0.0.1:4173/doc2md/`; comparison mockup remains historical. No commit, PR, installer release or deployment was requested.


## October 11 final build and PR instruction

The user requested full build/validation, self-review, independent Claude review, reasonable fixes, then a PR. That instruction supersedes the earlier local-only status above. B is implemented. Imported output renames preserve source metadata; native renames update existing library paths without changing enrollment. Download readiness text is removed, settings and disabled controls are accessible, and document commands hide on Install & Use. See the [final review record](history/combined-toolbar-review-2026-10-11.md) for final validation, review dispositions and known baseline Safari failures. The animation remains unchanged by explicit user decision.

## October 12 Settings follow-up

The user approved replacing internal Install & Use navigation with an external documentation link, and replacing below-workspace About content with a small dialog. Both actions preserve the document workspace. The About dialog shows version and project resources immediately, closes with Close/Escape, and returns focus to Settings. Installation documentation now links directly to release downloads rather than sending readers back to the removed internal tab.

Validation: 1,019 unit tests passed; 31 focused Chromium cases and 10 mobile Chrome/Safari cases passed (3 existing desktop skips). Eight additional Chromium/WebKit checks covered the dialog in light/dark themes at desktop/phone widths. Lint completed with six existing warnings and no errors; typecheck and web/desktop shell builds passed. Native external-link routing was verified in the existing WKWebView delegate; native code was unchanged.
