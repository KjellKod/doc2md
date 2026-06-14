# Quest Journal: Quest Brief — Mobile Reading Space

- Quest ID: `mobile-reading-space_2026-06-14__0318`
- Slug: mobile-reading-space
- Completed: 2026-06-14
- Mode: workflow
- Quality: Gold
- Celebration: [`celebrations/mobile-reading-space_2026-06-14.md`](celebrations/mobile-reading-space_2026-06-14.md)
- Outcome: **Problem.** On hosted (web) phones the document reading area is squeezed by three chrome problems: (P0) once the user reopens the Upload sidebar to pick a second file there is no path back to the collapsed reading view — `handleSelectEntry` never re-collapses (`src/shell/webAdapter.tsx:386`), th...

## What Shipped

**Problem.** On hosted (web) phones the document reading area is squeezed by three chrome problems: (P0) once the user reopens the Upload sidebar to pick a second file there is no path back to the collapsed reading view — `handleSelectEntry` never re-collapses (`src/shell/webAdapter.tsx:386`), th...

## Files Changed

- `.quest/mobile-reading-space_2026-06-14__0318/phase_01_plan/plan.md`
- `.quest/mobile-reading-space_2026-06-14__0318/phase_01_plan/arbiter_verdict.md.next`
- `.quest/mobile-reading-space_2026-06-14__0318/phase_01_plan/review_findings.json.next`
- `.quest/mobile-reading-space_2026-06-14__0318/phase_01_plan/review_plan-reviewer-a.md`
- `.quest/mobile-reading-space_2026-06-14__0318/phase_01_plan/review_plan-reviewer-b.md`
- `.quest/mobile-reading-space_2026-06-14__0318/phase_02_implementation/pr_description.md`
- `.quest/mobile-reading-space_2026-06-14__0318/phase_02_implementation/builder_feedback_discussion.md`
- `src/shell/useWorkspaceResize.ts`
- `src/shell/webAdapter.tsx`
- `src/shell/AppShell.tsx`
- `src/App.tsx`
- `src/components/preview/PreviewPanel.tsx`
- `src/components/preview/PreviewToolbar.tsx`
- `src/components/preview/PreviewOverflowMenu.tsx`
- `src/styles/global.css`
- `src/shell/useWorkspaceResize.collapseOnPhoneSelect.test.tsx`
- `src/components/preview/PreviewOverflowMenu.test.tsx`
- `src/components/preview/PreviewToolbar.compact.test.tsx`
- `src/components/WorkingModeBar.test.tsx`
- `tests/e2e/hosted-mobile-tablet-layout.spec.ts`
- `tests/e2e/helpers/findBar.ts`
- `tests/e2e/editor-integration.spec.ts`
- `tests/e2e/inline-formatting.spec.ts`
- `tests/e2e/find-table-cells.spec.ts`
- `tests/e2e/find-highlight-leak.spec.ts`
- `tests/e2e/find-edit-overlay-wrap.spec.ts`
- `tests/e2e/find-fenced-code-mode-switch.spec.ts`
- `tests/e2e/find-linkedin-highlight.spec.ts`
- `tests/e2e/find-rendered-dense-list-highlight.spec.ts`
- `tests/e2e/find-replace-single-undo.spec.ts`
- `tests/e2e/find-replace-whole-word.spec.ts`
- `.quest/mobile-reading-space_2026-06-14__0318/phase_03_review/review_code-reviewer-a.md`
- `.quest/mobile-reading-space_2026-06-14__0318/phase_03_review/review_findings_code-reviewer-a.json`
- `.quest/mobile-reading-space_2026-06-14__0318/phase_03_review/review_code-reviewer-b.md`
- `.quest/mobile-reading-space_2026-06-14__0318/phase_03_review/review_findings_code-reviewer-b.json`
- `.quest/mobile-reading-space_2026-06-14__0318/phase_03_review/review_fix_feedback_discussion.md`
- `src/components/preview/__tests__/PreviewToolbar.compactShortcutsFocus.test.tsx`

## Iterations

- Plan iterations: 2
- Fix iterations: 1

## Agents

- **The Judge** (arbiter): 
- **The Implementer** (builder): 

## Quest Brief

Implement the 4 mobile reading-space recommendations for the hosted (web) mobile
view of doc2md. Full permissions: may commit, push, and create a PR without asking.

GOAL: Maximize document reading space on hosted mobile (phone) while NOT breaking
the desktop app or the bare web/desktop shells. All changes scoped to hosted
phones (`.app-shell-hosted` + phone media queries) unless a change is
intentionally shared.

### The 4 recommendations

- **P0 (highest impact, do first): Restore a mobile collapse affordance for the
  upload sidebar.** Today the only collapse path is the one-shot
  `triggerFirstOpenAutoCollapse` (`src/shell/useWorkspaceResize.ts:662`), the
  manual `.collapse-toggle` is `display:none` at `<=980px`
  (`src/styles/global.css:3583-3587`), and `handleSelectEntry` never re-collapses
  (`src/shell/webAdapter.tsx:386`). Result: after opening Uploads to pick a second
  file on mobile, there is NO way back to the collapsed reading view — a dead-end.
  Fix by either auto-collapsing on file select at phone widths, or exposing a
  mobile collapse control. Preferred: tapping a file fills the screen with the
  document.
- **P1: Fold the two stacked toolbar bands into ONE on hosted phones.** The
  Edit/View/LinkedIn toggle row + the New/Find/Save/MD/HTML/copy/shortcuts action
  row currently stack via column-flex forced at `src/styles/global.css:3925`. Keep
  Edit/View/LinkedIn segmented control + Save as primary; move secondary actions
  behind a single overflow "More"/menu/sheet. New component likely needed.
  (`src/components/preview/PreviewToolbar.tsx`.)
- **P2: Fold the standalone "UPLOAD" collapse-rail row into the working-mode bar**
  (scoped to hosted phones) so it stops eating its own band. Rail rendered in
  `src/shell/AppShell.tsx:447`; working-mode bar in
  `src/components/WorkingModeBar.tsx`. Desktop must keep the rail as-is.
- **P3 — DEFERRED (user decision: "defer P3, measure first").** Originally:
  "let read-only View/LinkedIn grow with the document on phones." This CONFLICTS
  with the deliberate Edit==View parity invariant from PR #176 (journal 053),
  locked by `tests/e2e/hosted-mobile-tablet-layout.spec.ts:200`
  (`EQUAL_WINDOW_TOLERANCE_PX`). **P3 is NOT implemented in this quest.** The #176
  parity test stays INTACT and passing. Instead, P3 is captured as a measured
  follow-up: after P0–P2 land, measure the reclaimed preview-panel height /
  surface-dominance ratio on hosted phone (375x800) before vs after (using the
  existing `SURFACE_DOMINANCE_FLOOR` 0.48 and the `panel >= 0.55 * viewport`
  metrics), so the user can decide later whether P3's regression risk is still
  worth it. P0–P2 preserve parity (chrome reduction grows the panel, so Edit and
  View grow together).

  **IMPLEMENTATION SCOPE FOR THIS QUEST = P0, P1, P2 ONLY.**

### Hard constraints

- Do NOT break desktop app or the bare-web/desktop shells. Scope everything to
  `.app-shell-hosted` + phone/tablet media queries unless intentionally shared.
- Preserve the iOS keyboard-occlusion fix from PR #176 (Edit surface must stay
  `>=64px` and in-viewport when keyboard open). Edit sizing is off-limits for P3.
- 320px is the documented min width (no horizontal overflow). 44px tap-target
  floor on primary controls.
- Existing e2e contracts in `tests/e2e/hosted-mobile-tablet-layout.spec.ts` must
  be honored or intentionally + explicitly updated when a recommendation
  deliberately changes the behavior they guard (notably the collapse-rail test
  ~line 304 for P2, and the Edit==View parity test ~line 200 for P3).
- CI is known-flaky on the WebKit/mobile-safari path (see
  `docs/diary/2026-06-10.md`); write waits/assertions defensively.
- Repo persona: Claude is "Jean-Claude"; PR description + review replies authored
  as Jean-Claude (see `.claude/CLAUDE.md`).

### Done criteria

1. Solid mobile implementation of P0–P2 (P3 deferred as a measured follow-up),
   desktop + web shells unbroken, full test suite (vitest + e2e) + typecheck +
   lint green. The PR #176 Edit==View parity e2e assertion stays intact and
   passing.
2. pr-assistant has created a PR that is ready for review (authored as
   Jean-Claude).
3. Quest celebrated and archived.
4. pr-shepherd kicked off on the new PR.

## Carry-Over Findings

- No carry-over findings this round; nothing was inherited from earlier quests and nothing needs to be saved for the next one.

## Celebration

This journal embeds the celebration payload used by `/celebrate`.

- Full celebration: [`celebrations/mobile-reading-space_2026-06-14.md`](celebrations/mobile-reading-space_2026-06-14.md)
- [Jump to Celebration Data](#celebration-data)
- Replay locally: `/celebrate docs/quest-journal/mobile-reading-space_2026-06-14.md`

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
      "desc": "Tackled 24 review findings"
    },
    {
      "icon": "[TEST]",
      "title": "Battle Tested",
      "desc": "Survived 6 reviews"
    },
    {
      "icon": "[SHIP]",
      "title": "Ship It",
      "desc": "PR #185 created"
    },
    {
      "icon": "[PLAN]",
      "title": "Plan Perfectionist",
      "desc": "Iterated plan 2 times"
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
      "label": "Plan iterations: 2"
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
    "tier": "Gold",
    "grade": "G"
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
  "files_changed": 37
}
```
<!-- celebration-data-end -->
