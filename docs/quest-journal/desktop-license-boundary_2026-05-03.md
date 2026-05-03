# Quest Journal: Stronger Desktop License Boundary Refactor

- Quest ID: `desktop-license-boundary_2026-05-03__0954`
- Slug: desktop-license-boundary
- Completed: 2026-05-03
- Mode: workflow
- Quality: Tin
- Outcome: $quest in the existing branch, "Stronger desktop license boundary refactor for doc2md. Context: - Work on the existing `license-improvements-dual-model` branch after PR #103 license wording is curr...

## What Shipped

**Problem**: Desktop-only UI, bridge, persistence, save/open/reveal, menu, and CSS behavior currently has ambiguous mixed-license exposure in broad shared paths. The license/docs model also needs a post-refactor review so MIT components stay clearly MIT while the Mac desktop app and desktop-speci...

## Files Changed

- `.quest/desktop-license-boundary_2026-05-03__0954/phase_01_plan/plan.md`
- `.quest/desktop-license-boundary_2026-05-03__0954/phase_01_plan/arbiter_verdict.md.next`
- `.quest/desktop-license-boundary_2026-05-03__0954/phase_01_plan/review_findings.json.next`
- `.quest/desktop-license-boundary_2026-05-03__0954/phase_01_plan/review_plan-reviewer-a.md`
- `.quest/desktop-license-boundary_2026-05-03__0954/phase_01_plan/review_plan-reviewer-b.md`
- `.quest/desktop-license-boundary_2026-05-03__0954/phase_02_implementation/pr_description.md`
- `.quest/desktop-license-boundary_2026-05-03__0954/phase_02_implementation/builder_feedback_discussion.md`
- `.quest/desktop-license-boundary_2026-05-03__0954/phase_03_review/review_code-reviewer-a.md`
- `.quest/desktop-license-boundary_2026-05-03__0954/phase_03_review/review_findings_code-reviewer-a.json`
- `.quest/desktop-license-boundary_2026-05-03__0954/phase_03_review/review_code-reviewer-b.md`
- `.quest/desktop-license-boundary_2026-05-03__0954/phase_03_review/review_findings_code-reviewer-b.json`

## Iterations

- Plan iterations: 4
- Fix iterations: 0

## Agents

- **The Judge** (arbiter): 
- **The Implementer** (builder): 

## Quest Brief

$quest in the existing branch, "Stronger desktop license boundary refactor for doc2md.

Context:
- Work on the existing `license-improvements-dual-model` branch after PR #103 license wording is current.
- This is a dual-purpose quest:
  1. Strengthen the code/license boundary by moving desktop-only React/CSS/bridge behavior into desktop-owned paths.
  2. Re-review the license/docs boundary after the refactor to ensure the custom desktop shareware model still reads clearly and does not accidentally restrict MIT components.

Goals:
- Keep `@doc2md/core`, `packages/core/`, hosted web/shared converter code, and MIT-marked files under MIT.
- Keep the Mac desktop app and desktop-specific UI/bridge code under `LicenseRef-doc2md-Desktop`.
- Reduce or eliminate ambiguous mixed-license sections inside shared root `src` files.
- Preserve existing behavior for:
  - hosted web app
  - `@doc2md/core`
  - Mac desktop app
  - desktop bridge/save/open/reveal/persistence behavior
- Do not change the business model.
- Do not introduce BSL, FSL, Elastic, PolyForm, Commons Clause, GPL, AGPL, or SSPL.

Target areas to inspect:
- `src/App.tsx`
- `src/hooks/useFileConversion.ts`
- `src/hooks/useFileConversion.helpers.ts`
- `src/styles/global.css`
- `src/desktop/`
- `src/types/doc2mdShell.d.ts`
- `LICENSE`
- `LICENSES/LicenseRef-doc2md-Desktop.txt`
- `docs/licensing.md`
- `apps/macos/LICENSE`
- `apps/macos/THIRD_PARTY_NOTICES.md`
- `README.md`

Implementation direction:
- Move desktop-only React UI/bridge/persistence/save/reveal/menu code out of broad shared files and into `src/desktop/` or another clearly desktop-owned path.
- Move desktop-only CSS selectors into a desktop-owned stylesheet if practical.
- Keep shared hosted-web/converter logic in MIT-covered paths.
- Use file-level `SPDX-License-Identifier: LicenseRef-doc2md-Desktop` for desktop-owned files.
- Avoid broad rewrites unrelated to the boundary.
- If complete movement is too risky, mark exact residual mixed sections and document why they remain.

Contribution hygiene:
- Add a friendly GitHub PR template now.
- Do not add a heavy issue template unless noisy contribution issues already justify it.
- The PR template should route contributors without legal wall text:
  - Which area does this touch?
  - If this touches desktop-license-covered files, confirm understanding that contributions may require explicit contributor terms.
  - If unsure, open an issue first.
  - Do not paste proprietary/client/confidential content.
- Suggested PR template section:

```markdown

## Carry-Over Findings

- No carry-over findings this round; nothing was inherited from earlier quests and nothing needs to be saved for the next one.

## Celebration

This journal embeds the celebration payload used by `/celebrate`.

- [Jump to Celebration Data](#celebration-data)
- Replay locally: `/celebrate docs/quest-journal/desktop-license-boundary_2026-05-03.md`

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
      "desc": "Tackled 14 review findings"
    },
    {
      "icon": "[TEST]",
      "title": "Battle Tested",
      "desc": "Survived 4 reviews"
    },
    {
      "icon": "[PLAN]",
      "title": "Plan Perfectionist",
      "desc": "Iterated plan 4 times"
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
      "label": "Plan iterations: 4"
    },
    {
      "icon": "🔧",
      "label": "Fix iterations: 0"
    },
    {
      "icon": "📝",
      "label": "Review findings: 4"
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
    "count": 0,
    "summaries": []
  },
  "test_count": null,
  "tests_added": null,
  "files_changed": 11
}
```
<!-- celebration-data-end -->
