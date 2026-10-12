---
target: doc2md shared web and Mac interface
total_score: 25
max_score: 40
na_heuristics:
p0_count: 0
p1_count: 1
target_identity: "file:src/shell/AppShell.tsx"
target_fingerprint: "sha256:75a610e68257794562f4ff1d8145321afe4da0948c027f0262e8b6c3f7b4bf71"
target_path: src/shell/AppShell.tsx
timestamp: 2026-10-10T01-09-55Z
slug: src-shell-appshell-tsx
---
Method: dual-agent (A: design_assessment · B: evidence_assessment)

# doc2md shared interface critique

Target: `src/shell/AppShell.tsx`. Mode: Operate. Live desktop web inspection plus shared source; mobile and native Mac operation not exercised. This is a heuristic assessment, not a usability study or a measure of market appeal.

## Design specificity and overall impression

Preserve the identity; improve the path through it. Editorial typography, restrained blue accents, and local-processing reassurance give doc2md recognizable character. The main opportunity is making a mature, capable tool feel simpler once someone begins working. Evidence does not justify a wholesale redesign.

## Design health

| Heuristic | Score / 4 | Main finding |
|---|---:|---|
| System status | 3 | Useful unsaved/conversion signals; browser Saved overpromises |
| Familiar language | 2 | Upload conflicts with Nothing is uploaded |
| User control | 2 | Unsaved drafts can be cleared without recovery |
| Consistency | 3 | Coherent controls; Save/Download meanings diverge |
| Error prevention | 2 | Clear bypasses dirty-work protection |
| Recognition | 3 | Labeled core controls; specialty output requires interpretation |
| Efficiency | 3 | Strong shortcuts and batch tools; crowded presentation |
| Minimalist design | 2 | Introductory chrome competes with active work |
| Error recovery | 3 | Helpful conversion fallbacks; some export failures only logged |
| Help | 2 | Shortcut help exists; beginner output guidance is weaker |
| Total | 25/40 | Acceptable under the rubric; focused improvements needed |

## What's working

- Local-processing reassurance and honest conversion warnings build trust.
- Starting a draft, editing, and switching to rendered View work directly; document typography is comfortable.
- Batch handling, find/replace, shortcuts, and resizable panels provide useful depth. Preserve capabilities while simplifying access.

## Priority issues

1. **P1: Clear discards unsaved browser work immediately.** Reproduced with a disposable draft: Unsaved → Clear → draft gone, with no confirmation or undo. `src/shell/webAdapter.tsx:398` directly removes entries at line 409; `src/components/FileList.tsx:82` presents Clear. Protect dirty drafts through explicit discard confirmation or recoverable close. Distinguish closing a file from discarding changes. Suggested command: `$impeccable harden`.

2. **P2: Starting a draft leaves the introduction competing with the document.** The large heading, format paragraph, and intake panel remain prominent during writing. Existing intro-collapse control was disabled for the small scratch draft. Let Start writing/New enter the working layout with an easy route back. `src/shell/AppShell.tsx:346` gates collapse; `src/shell/webAdapter.tsx:413` creates a draft without hiding landing chrome. Suggested command: `$impeccable layout`.

3. **P2: Browser Save and Download make different promises about essentially the same action.** Save downloads a file and later marks Saved; separate Markdown download uses the same output mechanism. A newcomer cannot tell whether the original changed or a copy was created. Use explicit download/copy language and truthful completion feedback in browser; preserve native Save/Save As on Mac. `src/shell/webAdapter.tsx:472`, `:510`; `src/components/preview/PreviewToolbar.tsx:498`. Suggested command: `$impeccable clarify`.

4. **P2: Toolbar gives specialty functions too much prominence.** New draft exposes 11 controls including LinkedIn, line numbers, multiple outputs, and help. LinkedIn is a peer of Edit/View. Keep common work prominent and group specialty formatting, alternate outputs, and display options without sacrificing shortcuts. `src/components/preview/PreviewToolbar.tsx:423` onward. Suggested command: `$impeccable distill`.

5. **P2: First-use copy emphasizes technical inventory over outcome.** Ten extensions, Markdown terminology, and Install & Use ask beginners to interpret the product before using it. Rename Upload to Open files, explain Markdown briefly, and lead with what the result enables. Keep detailed formats and automation guidance available. `src/shell/AppShell.tsx:356`, `:375`, `:479`; `src/components/DropZone.tsx:111`; `src/components/AboutSection.tsx:67`. Suggested command: `$impeccable clarify`.

## Cognitive load

Moderate: three checklist failures in visual hierarchy, minimal choices, and progressive disclosure. The toolbar exposes 11 controls; the mode group is manageable, but the action row has seven. Grouping is otherwise reasonable and Edit/View preserves context. Simultaneous relevance matters more than raw button count.

## Emotional journey

Arrival feels considered and privacy-conscious; editing and preview provide confidence. Output ambiguity weakens the finish. Accidental removal is the sharpest loss of trust. Protect that ending before adding decorative delight.

## Persona red flags

- Jordan, first-timer: Markdown, specialty modes, MD/HTML output, and Save versus Download require interpretation. Needs an understandable result and truthful completion feedback.
- Alex, power user: Strong shortcuts and batch tools, but small scratch drafts retain the large introduction with no active collapse control. Preserve accelerators when reducing chrome.
- Sam, accessibility-dependent: Visible editing focus, labeled controls, and named keyboard-resizable splitters are positive. Nested interactive regions and icon/tooltips deserve a dedicated audit. No full VoiceOver or keyboard-only audit was performed.

## Deterministic findings and synthesis

Actual command: `impeccable detect --json src`, exit 2, 12 warnings, no errors.

| Rule | Count | Locations | Interpretation |
|---|---:|---|---|
| overused-font | 5 | src/components/preview/pasteLargeGoogleDoc.repro.test.ts:7,15; src/components/preview/pasteToMarkdown.test.ts:57,60,65 | Arial in clipboard fixtures; false positives |
| broken-image | 3 | src/converters/office.test.ts:49,60; src/converters/office.ts:10 | Fixture text and image-stripping regex; false positives |
| side-tab | 3 | src/styles/global.css:1373,3157,3295 | Selection accent and blockquote are conventional; About callout is low-priority style candidate |
| layout-transition | 1 | src/styles/global.css:3743 | Width transition, reduced-motion guarded; potential performance review, not observed jank |

Eight definite false positives, two conventional/contextually justified patterns, one cosmetic candidate, one performance candidate. No evidence of broken shipped images or inappropriate product fonts. Both assessments independently observed the persistent hero and crowded toolbar. Detector added no reason to replace the visual identity.

## Minor observations

- View names both the panel and a mode; Document would be a stable panel identity.
- Preserve conversion warnings and PDF quality indicators.
- Mobile code includes condensed controls and safe-area handling; desktop density is not evidence of mobile failure.
- Mac native open/save/persistence semantics differ from browser downloads. Do not transplant browser terminology mechanically.

## Questions to consider

- Should creating or opening a document always graduate into the working layout?
- Should the primary completion emphasize a Markdown download, copied text, or readable HTML?
- Is LinkedIn central to the broad audience, or a specialty feature better surfaced on demand?
