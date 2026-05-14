# Quest Journal: PreviewPanel Refactor — Phase 1

- Quest ID: `preview-panel-refactor-phase-1_2026-05-13__2241`
- Slug: preview-panel-refactor-phase-1
- Completed: 2026-05-14
- Mode: workflow
- Quality: Gold
- Outcome: `src/components/PreviewPanel.tsx` is a 1285-line, load-bearing component that owns mode switching, find UI wiring, viewport anchor handoff, rendered find snapshots, copy behavior, edit shortcuts, empty states, toolbar controls, and three different render surfaces. The goal is a behavior-preservin...

## What Shipped

`src/components/PreviewPanel.tsx` is a 1285-line, load-bearing component that owns mode switching, find UI wiring, viewport anchor handoff, rendered find snapshots, copy behavior, edit shortcuts, empty states, toolbar controls, and three different render surfaces. The goal is a behavior-preservin...

## Files Changed

- `.quest/preview-panel-refactor-phase-1_2026-05-13__2241/phase_01_plan/plan.md`
- `.quest/preview-panel-refactor-phase-1_2026-05-13__2241/phase_01_plan/arbiter_verdict.md.next`
- `.quest/preview-panel-refactor-phase-1_2026-05-13__2241/phase_01_plan/review_findings.json.next`
- `.quest/preview-panel-refactor-phase-1_2026-05-13__2241/phase_01_plan/review_plan-reviewer-a.md`
- `.quest/preview-panel-refactor-phase-1_2026-05-13__2241/phase_01_plan/review_plan-reviewer-b.md`
- `.quest/preview-panel-refactor-phase-1_2026-05-13__2241/phase_02_implementation/pr_description.md`
- `.quest/preview-panel-refactor-phase-1_2026-05-13__2241/phase_02_implementation/builder_feedback_discussion.md`
- `.quest/preview-panel-refactor-phase-1_2026-05-13__2241/phase_03_review/review_code-reviewer-a.md`
- `.quest/preview-panel-refactor-phase-1_2026-05-13__2241/phase_03_review/review_findings_code-reviewer-a.json`
- `.quest/preview-panel-refactor-phase-1_2026-05-13__2241/phase_03_review/review_code-reviewer-b.md`
- `.quest/preview-panel-refactor-phase-1_2026-05-13__2241/phase_03_review/review_findings_code-reviewer-b.json`
- `.quest/preview-panel-refactor-phase-1_2026-05-13__2241/phase_03_review/review_fix_feedback_discussion.md`

## Iterations

- Plan iterations: 2
- Fix iterations: 1

## Agents

- **The A Code Critic** (code-reviewer-a): 

## Quest Brief

Full original prompt was not recorded for this quest. This is the best available brief context.

```
Quest brief: PreviewPanel Refactor — Phase 1

Context

- Source proposal: ideas/preview-panel-refactor.md. Read it first.
- Companion bug (open, do NOT fix in this quest): ideas/bug_report_find_preview_table_cells.md.
- Companion bugs (closed, reference only): ideas/archive/bug_report_find_highlight_dom_leaks.md, ideas/archive/bug_report_find_match_scrolls_to_wrong_line.md.
- Current file sizes: src/components/PreviewPanel.tsx ~1285 lines, src/App.tsx ~1306, src/desktop/DesktopApp.tsx ~2911. Proposal cited 1038/756/2239 — every file grew. PR #123 already moved find-highlight from DOM mutation to a rehype plugin, so the "kill DOM mutation" step is done. Phase 2 (AppShell dedup of App.tsx + DesktopApp.tsx) is OUT OF SCOPE.

Goal

Split src/components/PreviewPanel.tsx into a thin shell + three mode components + two hooks, preserving 100% of current behavior. No bug fixes. No new features.

Target shape:
  src/components/preview/PreviewPanel.tsx     (shell)
  src/components/preview/EditMode.tsx
  src/components/preview/PreviewMode.tsx
  src/components/preview/LinkedInMode.tsx
  src/components/preview/useViewportAnchor.ts
  src/components/preview/useFindHighlight.tsx

Required scope (test-first, ordered)

1. Characterization tests FIRST. Audit tests/e2e/find-*.spec.ts, view-anchor-mode-switch.spec.ts, src/components/__tests__/. Add coverage for: (a) find <mark> appears only in active mode tree after switch, (b) anchor survives mode switch on soft-wrapped paragraph, (c) edit-mode typing leaves no ghost highlights in preview, (d) Cmd+F preserves query across mode switch and re-runs search. Commit these BEFORE any structural change. Run against current main — all must pass; failures = stop and file a bug, not fix here.

2. Extract useViewportAnchor wrapping src/components/viewportAnchor.ts helpers. API: useViewportAnchor(ref, kind) → { captureAnchorLine, applyAnchorLine }. Suite green before next step.

3. Extract useFindHighlight wrapping src/components/findHighlightRehype.ts. Do NOT rewrite the plugin — byte-identical output. Edit-mode renderFindHighlight stays in EditMode (different domain). Suite green.

4. Extract three mode components. Shell owns mode state, toolbar, save controls, FindReplaceBar wiring, Cmd+F interception, anchor handoff ref. Mounts exactly one mode at a time. PreviewPanelProps unchanged. External callers (DesktopApp.tsx, App.tsx) unchanged.

5. SRP/KISS/YAGNI sweep. No BaseMode class, no HOC, no mode context, no plugin registry, no "future" hooks.

Acceptance criteria

- Shell ≤350 lines; each mode ≤500; each hook ≤200 (sanity ceilings).
- PreviewPanelProps interface unchanged.
- git diff main -- src/App.tsx src/desktop/DesktopApp.tsx is empty.
- All existing Playwright + unit tests pass unmodified.
- New characterization tests pass against both pre- and post-refactor commits.
- Table-cells bug NOT fixed here; PR description notes refactor makes future fix smaller.
- Mac manual validation: npm run build:mac && open .build/mac/Build/Products/Release/doc2md.app, exercise edit/preview/linkedin switch + find in each mode + resize handles. No regressions.

Validation

- npm run lint && npm run typecheck && npm test && npm run test:e2e all green.
- wc -l src/components/preview/* confirms ceilings.
- git diff main..HEAD -- src/App.tsx src/desktop/DesktopApp.tsx empty.
- grep -rn "from .*components/PreviewPanel" src/ tests/ confirms import path preserved.

Constraints

- Test-first. Characterization commits precede refactor commits — a reviewer can checkout the test commit alone and watch the suite pass against pre-refactor code.
- No bug fixes. No converter/save/Sparkle/licensing/theme changes. No App.tsx / DesktopApp.tsx changes.
- Honor AGENTS.md: KISS, DRY (not premature), YAGNI, SRP, strong typing.

Out of scope

- Phase 2 AppShell dedup → separate quest after Phase 1 lands.
- Table-cells bug fix → separate quest post-refactor.
```

## Findings Left For Future Quests

- Count: **2**
- Forward reference to function declaration viewportTopFloor reduces top-to-bottom readability of the shell.
- MutableElementRef<T> interface is duplicated across three mode files; ReadableRef<T> in useViewportAnchor.ts is the same structural shape.

## Celebration

This journal embeds the celebration payload used by `/celebrate`.

- [Jump to Celebration Data](#celebration-data)
- Replay locally: `/celebrate docs/quest-journal/preview-panel-refactor-phase-1_2026-05-14.md`

## Celebration Data

<!-- celebration-data-start -->
```json
{
  "quest_mode": "workflow",
  "agents": [
    {
      "name": "code-reviewer-a",
      "model": "",
      "role": "The A Code Critic"
    }
  ],
  "achievements": [
    {
      "icon": "[BUG]",
      "title": "Gremlin Slayer",
      "desc": "Tackled 3 review findings"
    },
    {
      "icon": "[TEST]",
      "title": "Battle Tested",
      "desc": "Survived 5 reviews"
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
      "label": "Review findings: 5"
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
    "count": 2,
    "summaries": [
      "Forward reference to function declaration viewportTopFloor reduces top-to-bottom readability of the shell.",
      "MutableElementRef<T> interface is duplicated across three mode files; ReadableRef<T> in useViewportAnchor.ts is the same structural shape."
    ]
  },
  "test_count": null,
  "tests_added": null,
  "files_changed": 12
}
```
<!-- celebration-data-end -->
