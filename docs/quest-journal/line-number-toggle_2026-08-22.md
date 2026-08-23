# Quest Journal: Optional Line Numbers

- Quest ID: `line-number-toggle_2026-08-21__2114`
- Slug: line-number-toggle
- Completed: 2026-08-22
- Mode: workflow
- Quality: Tin
- Celebration: [`celebrations/line-number-toggle_2026-08-22.md`](celebrations/line-number-toggle_2026-08-22.md)
- Outcome: Added optional, session-scoped line numbers to Edit and rendered View without changing copied, saved, or exported content.

## What Shipped

**Problem:** Edit and rendered View do not expose stable source coordinates. Users need optional source line numbers without replacing the native textarea or changing document content.

**Impact:** One default-off control lets users orient themselves in Edit and View. Edit numbers every original Markdown source line, while View labels rendered blocks with their original source start line. LinkedIn and lightweight large JSON remain unchanged.

## Files Changed

- `.quest/line-number-toggle_2026-08-21__2114/phase_01_plan/arbiter_verdict.md.next`
- `.quest/line-number-toggle_2026-08-21__2114/phase_01_plan/review_findings.json.next`
- `.quest/line-number-toggle_2026-08-21__2114/phase_01_plan/review_plan-reviewer-a.md`
- `.quest/line-number-toggle_2026-08-21__2114/phase_01_plan/review_plan-reviewer-b.md`
- `.quest/line-number-toggle_2026-08-21__2114/phase_01_plan/plan.md`
- `.quest/line-number-toggle_2026-08-21__2114/phase_02_implementation/pr_description.md`
- `.quest/line-number-toggle_2026-08-21__2114/phase_02_implementation/builder_feedback_discussion.md`
- `.ai/allowlist.json`
- `src/components/preview/PreviewPanel.tsx`
- `src/components/preview/EditMode.tsx`
- `src/components/preview/PreviewMode.tsx`
- `src/components/preview/PreviewToolbar.tsx`
- `src/components/preview/PreviewOverflowMenu.tsx`
- `src/components/sourceLineRehype.ts`
- `src/components/preview/previewCopy.ts`
- `src/styles/global.css`
- `src/components/PreviewPanel.test.tsx`
- `src/components/__tests__/PreviewPanel.ime.test.tsx`
- `src/components/preview/PreviewToolbar.compact.test.tsx`
- `src/components/preview/PreviewOverflowMenu.test.tsx`
- `src/render/markdownToHtml.parity.test.tsx`
- `tests/e2e/find-edit-overlay-wrap.spec.ts`
- `tests/e2e/line-numbers.spec.ts`
- `.quest/line-number-toggle_2026-08-21__2114/phase_03_review/review_code-reviewer-a.md`
- `.quest/line-number-toggle_2026-08-21__2114/phase_03_review/review_findings_code-reviewer-a.json`
- `.quest/line-number-toggle_2026-08-21__2114/phase_03_review/review_code-reviewer-b.md`
- `.quest/line-number-toggle_2026-08-21__2114/phase_03_review/review_findings_code-reviewer-b.json`
- `.quest/line-number-toggle_2026-08-21__2114/phase_03_review/review_fix_feedback_discussion.md`
- `.quest/line-number-toggle_2026-08-21__2114/phase_03_review/review_arbiter_verdict.md.next`
- `.quest/line-number-toggle_2026-08-21__2114/phase_03_review/review_findings.json.next`

## Iterations

- Plan iterations: 3
- Fix iterations: 3

## Agents

- **The Judge** (arbiter):
- **The Implementer** (builder):

## Quest Brief

Add optional line numbers to Edit and rendered View.

### Goal

Users can toggle line numbers on and off while editing Markdown and while reading the rendered View.

### Read First

- `AGENTS.md`
- `docs/persona.md`
- `ideas/archive/doc2md-editor-engine-evaluation.md`
- `src/components/preview/EditMode.tsx`
- `src/components/preview/PreviewMode.tsx`
- `src/components/preview/PreviewPanel.tsx`
- `src/components/preview/PreviewToolbar.tsx`
- `src/components/sourceLineRehype.ts`
- `src/components/preview/previewCopy.ts`
- `src/components/viewportAnchor.ts`
- `src/styles/global.css`

### Decisions Already Made

- Keep the native textarea. Do not migrate to CodeMirror, Monaco, ProseMirror, or another editor engine.
- Add one Line numbers toggle, default off.
- The setting applies to Edit and rendered View.
- Keep LinkedIn mode unchanged.
- Keep the preference session-scoped across document and mode switches. Do not add browser storage or desktop persistence.
- Line numbers are visual UI only. Never include them in copied text, copied HTML, Markdown downloads, HTML exports, saved files, find text, or document state.
- In Edit, numbers represent every original Markdown source line.
- Wrapped continuations do not receive additional numbers.
- In rendered View, numbers represent the original Markdown source line where each rendered block starts. Jumps are intentional because blank lines and Markdown syntax are not rendered.
- Visual browser rows are not numbered because responsive wrapping is not a stable document coordinate.

### Edit Requirements

- Add an `aria-hidden` gutter aligned with the existing textarea.
- Preserve the textarea as the only editable and focusable surface.
- Correctly align empty lines, wrapped lines, long documents, and changing digit widths.
- Synchronize vertical scrolling with the textarea and existing find overlay.
- Preserve find highlighting, viewport anchoring, native undo, selection formatting, paste conversion, IME composition, caret restoration, and mobile behavior.
- Reuse the existing mirror and metric-matching patterns where practical. Avoid duplicating fragile layout logic.

### Rendered View Requirements

- Reuse `formatPreviewMarkdownWithLineMap` and existing `data-source-line` metadata.
- Extend source-line stamping only where necessary for useful block-level coverage, including headings, paragraphs, list items, code blocks, blockquotes, and table rows.
- Support the large Markdown table fallback without breaking virtualization.
- Define and test explicit behavior for the lightweight large JSON preview. Prefer correct visible source numbering, otherwise suppress View numbers for that fallback with a documented reason.
- Do not alter exported HTML or Markdown rendering semantics.
- Do not break interactive task checkboxes or mode-switch viewport anchoring.

### Toggle UX

- Accessible pressed-state control with Show line numbers and Hide line numbers labeling.
- Desktop control in the existing toolbar action area, outside the View mode ARIA group.
- Compact and mobile control in the existing More actions menu.
- Usable in light and dark themes.
- No new keyboard shortcut unless the plan establishes a strong need.

### Testing

- Write focused regressions before implementation where behavior is currently absent or fragile.
- Toggle defaults off and changes both supported modes.
- State survives Edit and View and document switches within the session.
- Edit gutter aligns after empty lines, wrapped lines, scrolling, and line-count digit changes.
- Rendered numbers map to original source after preview formatting changes line positions.
- Cover lists, fenced code, tables, and large-document fallback behavior.
- Copy Markdown, copy formatted text, rich clipboard HTML, Markdown download, save, and HTML export exclude line numbers.
- Find, mode-switch viewport anchoring, task checkboxes, IME, and compact toolbar behavior remain intact.
- Validate desktop and hosted layouts, including phone width.
- Run lint, typecheck, focused tests, full unit tests, build, and relevant Playwright coverage.

### Quality Constraints

KISS, DRY, SRP, YAGNI. Minimal focused changes. No editor-engine migration. No source edits before explicit Build approval. Use a new Quest worktree and follow the full repo-local Quest gate sequence.

## Findings Left For Future Quests

- Count: **6**
- Fragment offset map uses a magic zero branch and a divergent line splitter
- Fixed 3rem View column ignores the document it is numbering
- Generated-content markers fail closed on engines that do not parse the alt-text form

## Celebration

This journal embeds the celebration payload used by `/celebrate`.

- Full celebration: [`celebrations/line-number-toggle_2026-08-22.md`](celebrations/line-number-toggle_2026-08-22.md)
- [Jump to Celebration Data](#celebration-data)
- Replay locally: `/celebrate docs/quest-journal/line-number-toggle_2026-08-22.md`

## Celebration Data

<!-- celebration-data-start -->
```json
{
  "quest_mode": "workflow",
  "agents": [
    {
      "name": "arbiter",
      "model": "",
      "role": "The Judge",
      "transport": "background-agent"
    },
    {
      "name": "builder",
      "model": "",
      "role": "The Implementer"
    }
  ],
  "claude_transport_counts": {
    "background-agent": 16
  },
  "achievements": [
    {
      "icon": "[BUG]",
      "title": "Gremlin Slayer",
      "desc": "Tackled 45 review findings"
    },
    {
      "icon": "[TEST]",
      "title": "Battle Tested",
      "desc": "Survived 10 reviews"
    },
    {
      "icon": "[PLAN]",
      "title": "Plan Perfectionist",
      "desc": "Iterated plan 3 times"
    },
    {
      "icon": "[WIN]",
      "title": "Quest Complete",
      "desc": "All phases finished successfully"
    }
  ],
  "metrics": [
    {
      "icon": "📊",
      "label": "Plan iterations: 3"
    },
    {
      "icon": "🔧",
      "label": "Fix iterations: 3"
    },
    {
      "icon": "📝",
      "label": "Review rounds: 10"
    },
    {
      "icon": "🚌",
      "label": "Claude transport: background-agent ×16"
    }
  ],
  "quality": {
    "tier": "Tin",
    "grade": "T"
  },
  "inherited_findings_used": {
    "count": 0,
    "summaries": []
  },
  "findings_left_for_future_quests": {
    "count": 6,
    "summaries": [
      "Fragment offset map uses a magic zero branch and a divergent line splitter",
      "Fixed 3rem View column ignores the document it is numbering",
      "Generated-content markers fail closed on engines that do not parse the alt-text form"
    ]
  },
  "test_count": null,
  "tests_added": null,
  "files_changed": 30
}
```
<!-- celebration-data-end -->
