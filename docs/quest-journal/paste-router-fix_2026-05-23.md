# Quest Journal: Paste Router Fix

- Quest ID: `paste-router-fix_2026-05-22__2048`
- Slug: paste-router-fix
- Completed: 2026-05-23
- Mode: solo
- Quality: Gold
- Outcome: Implement a narrow paste-router fix, not a converter rewrite. The upload path already works because it sends the full saved HTML directly into the HTML converter. The paste path is where doc2md los...

## What Shipped

**Problem**: Paste routing can choose clipboard `text/html` even when that HTML is truncated and `text/plain` contains more complete content, causing content loss. A second risk is over-aggressive plain-text preference when HTML has meaningful structure.

**Scope**: `src/components/preview/pasteT...

## Files Changed

- `.quest/paste-router-fix_2026-05-22__2048/phase_01_plan/plan.md`
- `.quest/paste-router-fix_2026-05-22__2048/phase_01_plan/review_plan-reviewer-a.md`
- `.quest/paste-router-fix_2026-05-22__2048/phase_02_implementation/pr_description.md`
- `.quest/paste-router-fix_2026-05-22__2048/phase_02_implementation/builder_feedback_discussion.md`
- `.quest/paste-router-fix_2026-05-22__2048/phase_03_review/review_code-reviewer-a.md`
- `.quest/paste-router-fix_2026-05-22__2048/phase_03_review/review_findings_code-reviewer-a.json`

## Iterations

- Plan iterations: 2
- Fix iterations: 0

## Agents

- **The Judge** (arbiter): 
- **The Implementer** (builder): 

## Quest Brief

Implement a narrow paste-router fix, not a converter rewrite.

The upload path already works because it sends the full saved HTML directly into the HTML converter. The paste path is where doc2md loses either content or formatting, because it chooses between clipboard `text/html` and `text/plain` before conversion.

Required changes:

1. Add a clipboard HTML completeness check. Before trusting `text/html`, compare its visible text against `text/plain` after whitespace normalization. If HTML is clearly incomplete, for example only the bottom of the document while plain text contains the full document, fall back to `text/plain`. Content preservation wins over formatting.
2. Tighten the Markdown-looking plain text fallback. Only prefer plain text when HTML is truly a trivial wrapper around already-Markdown text. If HTML has real structure like headings, lists, tables, links, bold, italic, or meaningful inline styles, use HTML.
3. Leave the shared converter mostly alone. The fix should stay in `src/components/preview/pasteToMarkdown.ts` unless a very small normalizer adjustment is needed.
4. Add synthetic tests only. Do not use, reference, commit, or mention any private document fixture. If a committed document fixture becomes necessary, stop and ask the user for a sanitized fixture.

Expected tests:
- truncated clipboard HTML plus complete plain text should not drop the start;
- meaningful HTML plus Markdown-looking plain text should still use HTML;
- existing markdown/plain-text paste cases still avoid Turndown escaping;
- existing Google Docs paste/list behavior still passes.

YAGNI boundaries:
- no new size limits;
- no new paste engine;
- no broad converter rewrite;
- no upload behavior changes;
- no private document fixture or reference in code, tests, PR text, or comments.

## Carry-Over Findings

- No carry-over findings this round; nothing was inherited from earlier quests and nothing needs to be saved for the next one.

## Celebration

This journal embeds the celebration payload used by `/celebrate`.

- [Jump to Celebration Data](#celebration-data)
- Replay locally: `/celebrate docs/quest-journal/paste-router-fix_2026-05-23.md`

## Celebration Data

<!-- celebration-data-start -->
```json
{
  "quest_mode": "solo",
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
      "desc": "Tackled 2 review findings"
    },
    {
      "icon": "[TEST]",
      "title": "Battle Tested",
      "desc": "Survived 2 reviews"
    },
    {
      "icon": "[PLAN]",
      "title": "Plan Perfectionist",
      "desc": "Iterated plan 2 times"
    },
    {
      "icon": "[SOLO]",
      "title": "Solo Adventurer",
      "desc": "Completed quest with a single companion"
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
      "label": "Fix iterations: 0"
    },
    {
      "icon": "📝",
      "label": "Review findings: 2"
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
  "files_changed": 6
}
```
<!-- celebration-data-end -->
