# Quest Journal: Interactive task checkboxes inside Markdown table cells

- Quest ID: `table-cell-checkboxes_2026-06-27__0922`
- Slug: table-cell-checkboxes
- Completed: 2026-06-28
- Mode: workflow
- Quality: Platinum
- Celebration: [`celebrations/table-cell-checkboxes_2026-06-28.md`](celebrations/table-cell-checkboxes_2026-06-28.md)
- Outcome: Implement render-time, source-backed task checkboxes inside GFM table cells so a cell containing a leading marker such as `- [ ]`, `- [x]`, `[ ]`, or `[X]` renders as a real checkbox and toggles the exact source marker in Preview. This plan translates the human-reviewed design in `.ws/plan-table-...

## What Shipped

Implement render-time, source-backed task checkboxes inside GFM table cells so a cell containing a leading marker such as `- [ ]`, `- [x]`, `[ ]`, or `[X]` renders as a real checkbox and toggles the exact source marker in Preview. This plan translates the human-reviewed design in `.ws/plan-table-...

## Files Changed

- `.quest/table-cell-checkboxes_2026-06-27__0922/phase_01_plan/plan.md`
- `.quest/table-cell-checkboxes_2026-06-27__0922/phase_01_plan/arbiter_verdict.md.next`
- `.quest/table-cell-checkboxes_2026-06-27__0922/phase_01_plan/review_findings.json.next`
- `.quest/table-cell-checkboxes_2026-06-27__0922/phase_01_plan/review_plan-reviewer-a.md`
- `.quest/table-cell-checkboxes_2026-06-27__0922/phase_01_plan/review_plan-reviewer-b.md`
- `.quest/table-cell-checkboxes_2026-06-27__0922/phase_02_implementation/pr_description.md`
- `.quest/table-cell-checkboxes_2026-06-27__0922/phase_02_implementation/builder_feedback_discussion.md`
- `src/components/preview/tableCellCheckbox.ts`
- `src/components/preview/tableCellCheckbox.test.ts`
- `src/render/tableTaskCheckboxRehype.ts`
- `src/render/tableTaskCheckboxRehype.test.ts`
- `src/render/markdownToHtml.ts`
- `src/render/markdownToHtml.parity.test.tsx`
- `src/render/htmlExportStyles.ts`
- `src/components/preview/PreviewMode.tsx`
- `src/components/preview/taskCheckboxSource.ts`
- `src/components/preview/taskCheckboxSource.test.ts`
- `src/components/sourceLineRehype.ts`
- `src/components/PreviewPanel.test.tsx`
- `src/styles/global.css`
- `tests/e2e/hosted-browser-baseline.spec.ts`
- `docs/diary/2026-06-27.md`
- `.quest/table-cell-checkboxes_2026-06-27__0922/phase_03_review/review_code-reviewer-a.md`
- `.quest/table-cell-checkboxes_2026-06-27__0922/phase_03_review/review_findings_code-reviewer-a.json`
- `.quest/table-cell-checkboxes_2026-06-27__0922/phase_03_review/review_code-reviewer-b.md`
- `.quest/table-cell-checkboxes_2026-06-27__0922/phase_03_review/review_findings_code-reviewer-b.json`
- `.quest/table-cell-checkboxes_2026-06-27__0922/phase_03_review/review_fix_feedback_discussion.md`
- `.quest/table-cell-checkboxes_2026-06-27__0922/phase_03_review/review_arbiter_verdict.md.next`
- `.quest/table-cell-checkboxes_2026-06-27__0922/phase_03_review/review_findings.json.next`

## Iterations

- Plan iterations: 1
- Fix iterations: 1

## Agents

- **The Judge** (arbiter): 
- **The Implementer** (builder): 

## Quest Brief

Implement interactive task checkboxes inside Markdown table cells.

**SOURCE OF TRUTH**
The full design is in `.ws/plan-table-cell-task-checkboxes.md` (v3, passed plan
review at "READY TO IMPLEMENT"). Read it first and follow it. This brief is the
summary + guardrails, not a substitute for the plan.

**GOAL**
A checkbox inside a table cell behaves IDENTICALLY to a task-list checkbox
outside a table: same look, same clickability, same source write-back. Pasting

```
| MARKED | Name |
| --- | --- |
| - [ ] | Kjell Hedstrom |
| - [x] | Jane Doe |
```

must render real, clickable checkboxes in the MARKED cells; clicking one toggles
the exact source marker; the edit view keeps editable `- [ ]` source.

**HARD GUARDRAILS (these killed the previous attempt, PR #191 — do not repeat)**
- NEVER mutate source markdown at paste time. The paste path (`pasteToMarkdown.ts`)
  is OUT OF SCOPE and untouched. Do not recreate `tableCheckbox.ts`.
- NEVER substitute glyph characters (☐/☑). Render real `<input type=checkbox>`.
- Convertibility is decided on RAW SOURCE, never decoded HAST — escaped `\[ \]`
  must stay literal.
- Do not unify the two write-back functions. `replaceTaskMarkerAtSourceLine`
  stays byte-for-byte unchanged (it supports ordered markers `1) [ ]`); table rows
  use a NEW separate `replaceTaskMarkerByIndex`. Dispatch by attribute presence.

**IMPLEMENTATION ORDER (per plan §10)**
1. `src/components/preview/tableCellCheckbox.ts` — canonical module
   (recognizeCellMarker / enumerateRowMarkers / toggleRowMarkerByIndex). Build and
   fully unit-test FIRST; it is the data contract both render and write-back share.
2. `src/render/tableTaskCheckboxRehype.ts` — shared synthesis plugin, wired into
   BOTH `markdownToHtml.ts` (export) and `PreviewMode.tsx` (preview). Includes the
   raw-cell-count vs DOM `<td>/<th>`-count FAIL-SAFE: on mismatch, skip the row
   (leave literal) — never mis-map cells. Synthesized inputs are `disabled: true`.
3. Preview-only: stamp `data-task-source-line` + `data-task-marker-index` +
   aria-label (verify `tr/td/th` HAST positions first; fallback per plan §R3).
   Index-aware write-back in `taskCheckboxSource.ts` + `PreviewMode.tsx`.
4. CSS parity in `global.css` and `htmlExportStyles.ts` (cell selectors, not a
   guessed class).

**DECISIONS ALREADY MADE (don't relitigate)**
- One checkbox per cell: leading marker converts, later markers stay literal.
- Header `<th>` markers convert too.
- Export parity = yes (static checkbox in export; interactivity preview-only).
- No pipe-less GFM table support.

**ACCEPTANCE CRITERIA**
- All tests in plan §6 implemented and green, including: escaped-bracket guard;
  the 3-real-checkboxes-plus-decoys (link/code/escaped) on one source line, toggle
  the MIDDLE real one, assert only that span changes; pipe-inside-code fail-safe
  row; ordered-task-list regression guard; export-parity render; a hosted/desktop
  workflow-level toggle test.
- `npm test`, `npm run typecheck`, `npm run lint` all clean.
- Manual walkthrough (plan §6): paste the table → both render and toggle; edit view
  still shows editable `- [ ]` after toggling; multi-checkbox row toggles
  independently; `\[ \]` cell stays literal; export shows static checkboxes.
- Diary entry appended to `docs/diary/2026-06-27.md`.

**CONTEXT**
Branch `feat/table-cell-task-checkboxes` (off origin/main) is already checked out.
Follow AGENTS.md and docs/persona.md. UI behavior changes → ui_work=true.

## Carry-Over Findings

- No carry-over findings this round; nothing was inherited from earlier quests and nothing needs to be saved for the next one.

## Celebration

This journal embeds the celebration payload used by `/celebrate`.

- Full celebration: [`celebrations/table-cell-checkboxes_2026-06-28.md`](celebrations/table-cell-checkboxes_2026-06-28.md)
- [Jump to Celebration Data](#celebration-data)
- Replay locally: `/celebrate docs/quest-journal/table-cell-checkboxes_2026-06-28.md`

## Celebration Data

<!-- celebration-data-start -->
```json
{
  "quest_mode": "workflow",
  "agents": [
    {
      "name": "arbiter",
      "model": "",
      "role": "The Judge"
    },
    {
      "name": "builder",
      "model": "",
      "role": "The Implementer"
    }
  ],
  "achievements": [
    {
      "icon": "[BUG]",
      "title": "Gremlin Slayer",
      "desc": "Tackled 22 review findings"
    },
    {
      "icon": "[TEST]",
      "title": "Battle Tested",
      "desc": "Survived 6 reviews"
    },
    {
      "icon": "[SHIP]",
      "title": "Ship It",
      "desc": "PR #191 created"
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
      "label": "Plan iterations: 1"
    },
    {
      "icon": "🔧",
      "label": "Fix iterations: 1"
    },
    {
      "icon": "📝",
      "label": "Review findings: 6"
    }
  ],
  "quality": {
    "tier": "Platinum",
    "grade": "P"
  },
  "inherited_findings_used": {
    "count": 0,
    "summaries": []
  },
  "findings_left_for_future_quests": {
    "count": 0,
    "summaries": []
  },
  "test_count": null,
  "tests_added": null,
  "files_changed": 29
}
```
<!-- celebration-data-end -->
