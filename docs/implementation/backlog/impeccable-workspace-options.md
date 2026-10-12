---
title: doc2md workspace comparison
status: Design exploration; not approved for implementation
updated: 2026-10-10
---

# doc2md workspace comparison

The user wants the product to be intuitive without a newcomer introduction. This proposal uses Impeccable's Operate and Distill guidance to make controls, placement, and task feedback carry the explanation. The existing width animation remains unchanged unless evidence establishes a problem.

## October 11 correction

The user rejected both first mockups, especially A, after comparing them with the mature native app. The earlier positive review was insufficient: it checked extreme viewport widths and missed intermediate-width wrapping, repeated headings, and wasted document space. The original recommendation of B is withdrawn pending the revised comparison. Visible labels on familiar toolbar icons were explicitly rejected; use hover/focus tooltips and accessible names instead. The first screenshots are historical, not evidence that the proposals met the brief.

The revised alternatives isolate toolbar placement: A keeps one compact document toolbar; B combines controls in a single top bar where width permits. Both share typography, sidebar, sample document, icons, and spacing. No new brand or onboarding is proposed.

## Original recommendation (superseded)

Adopt the shared improvements in either option: a task-focused empty workspace, one place for Open/New, visible contextual Copy labels, clearly scoped file removal, and quieter secondary controls. Compare the two compositions before choosing how far to change the shell.

**A — Lighter toolbar** keeps the familiar sidebar/document-panel structure. It is the smaller implementation and the lower-disruption choice. It answers whether clearer hierarchy and labels are sufficient.

**B — Document workspace** reduces surrounding boxes, places the document title and output together, and gives the content more room. It is the stronger candidate for the user's goal of a natural app that needs no introduction, with more layout and responsive work to integrate safely.

Both use the current palette and typography. Neither introduces onboarding, new conversion capabilities, or a new brand. Their placements are design judgments based on task relationships, not measured usage frequency or a usability study.

## Shared changes worth making

1. **Begin with the task.** Keep a usable app header and show Open files / Start writing in a drop-enabled empty canvas. Remove the explanatory hero and avoid multiple empty panels saying the same thing. A short local-processing reassurance is useful context, not a tutorial.
2. **Use familiar, accurate names.** “Open files” fits local processing better than “Upload.” Name Copy by its output: Markdown, formatted text, or LinkedIn text. Name removal by its scope and preserve discard protection.
3. **Keep document views together.** Edit, Preview/View, and LinkedIn remain visible. LinkedIn changes the document presentation and copy result; it is not simply another download format.
4. **Separate global, document, and batch actions.** Open/New belongs to the app; modes, Find, Copy, and output belong to the document; batch controls appear when files are selected. Retain clear Files access on mobile.
5. **Reveal secondary tools without removing them.** Line numbers, shortcuts, and HTML export need a predictable menu or labeled control. A direct primary Markdown download must remain one click. Native Save and Save As must retain their file-writing meaning.
6. **Move supporting material out of the editing canvas.** Install & Use, About, and settings stay available through an app menu. Conversion warnings remain visible beside the affected document; they are not supporting marketing material.

## Comparison artifact

Open [the interactive comparison](../../design/workspace-comparison/index.html). Switch A/B, Empty/Working, Web/Mac, and Light/Dark; try editing, output menus, and mobile Files access. Screenshots live beside it in `screenshots/`.

The prototype was checked at desktop 1440px and mobile 390px in both states for both concepts: no script errors or horizontal page overflow. Dark Mac variants were captured. Editing/preview, Markdown download content, HTML menu/Escape, native-settings demonstration, mobile New focus, and Files toggle were exercised. Independent review identified two native-prototype issues; Save messaging and A’s missing Markdown export were corrected and verified. This is prototype validation, not a new product regression run.

The detector flagged the inherited cream background. A file-scoped `cream-palette` exception records that this comparison deliberately preserves the current identity. No palette change or product-source suppression was needed.

## Mockup boundaries

The comparison is a standalone HTML prototype using illustrative documents. It explores empty and working states, light/dark appearance, web/Mac action labels, and responsive structure. Its platform toggle is a design preview, not the native Mac app. Demonstration actions do not establish real converter, Finder, licensing, recent-file, or persistence behavior.

The actual React application has not been changed by this design exploration. Existing completed refinements remain in the working tree. No concept has yet been selected for implementation.

## Integration requirements if selected

- Empty-state Open/New must remain enabled; the current working header is inert when there is no selected document.
- Keep NativeMenuBridge mounted for Finder/Open With cold launches.
- Keep native Settings, recent files, Save As, Finder, reload/conflict recovery, and license behavior accessible.
- Preserve per-file conversion warnings, processing/error states, mixed-file batches, position state, find/replace, contextual formatting controls, and shortcuts.
- Preserve accessible names, focus order, visible focus, mobile touch targets, and menu keyboard behavior.
- If removing the existing navigation tabs, replace their ARIA relationships rather than leaving orphaned tab panels.
- Do not remove the width transition as part of this work.

The next product decision is whether either revised composition merits implementation. The smaller option is reasonable if minimal disruption is the priority; the flatter option better expresses a persistent document workspace. No additional discovery questionnaire is necessary.

## Revision 2 verification

The current [comparison](../../design/workspace-comparison/index.html) replaces the rejected labels with icon actions and exposes their names through hover/focus tooltips and accessible names. A is now “Document toolbar”; B is “Combined toolbar.” See [revision screenshots and measurements](../../design/workspace-comparison/screenshots/revision-2/metrics.json). At 980px with the same LinkedIn content, warning, and open Find, first-text offsets are 204px (A) and 160px (B). The rejected versions used approximately 533px and 415px respectively. One controlled placement difference remains: B saves A’s 44px document-toolbar row on desktop. No claim is made that either is better than the existing app overall.

Checks cover 320–1440px, including the previously missed 980/1050px range. Under 361px, Find/Copy remain accessible in More tools; primary output and mode controls remain visible. Prototype interaction checks and independent visual review are not production or native-runtime validation. No additional user questions were needed because the requested corrections were explicit.

## Selected prototype direction — October 11

The user prefers B (Combined toolbar). Both prototypes now expose a Settings gear with Appearance (Day/Night) and a Line numbers checkbox. Persistence is grouped here in the Mac preview only, matching the existing native feature. The checkbox demonstrates placement; it does not alter native persistence. Production integration remains pending.

Follow-up: the user found the adjacent gear and ellipsis redundant. Both prototypes now use a single gear popover combining preferences, secondary document actions, and help. The ellipsis is removed. Narrow-screen Find/Copy remain accessible in this combined popover.

B was subsequently approved for production and implemented. See [completion record](../history/combined-toolbar-2026-10-11.md); earlier pending-approval notes above are historical.
