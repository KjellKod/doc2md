# Quest Journal: Mac License Grace States

- Quest ID: `mac-license-grace-states_2026-07-16__1123`
- Slug: mac-license-grace-states
- Completed: 2026-07-20
- Mode: workflow
- Quality: Gold
- Celebration: [`celebrations/mac-license-grace-states_2026-07-20.md`](celebrations/mac-license-grace-states_2026-07-20.md)
- Outcome: Extend the Mac license state machine with grace and expired-reminder states. Goal: Implement Phase 1 of docs/implementation/mac-commercial-phase-7b-plan.md: extend the shipped license states in app...

## What Shipped

**Problem:** The shipped Mac app has no cached-entitlement lifecycle between `licensed` and the existing reminder-bearing free states. A Polar subscription snapshot that reaches `expires_at` therefore needs a deterministic, local-only transition into `grace` or `expiredReminder` without treating ...

## Files Changed

- `.quest/mac-license-grace-states_2026-07-16__1123/phase_01_plan/plan.md`
- `.quest/mac-license-grace-states_2026-07-16__1123/phase_01_plan/arbiter_verdict.md.next`
- `.quest/mac-license-grace-states_2026-07-16__1123/phase_01_plan/review_findings.json.next`
- `.quest/mac-license-grace-states_2026-07-16__1123/phase_01_plan/review_plan-reviewer-a.md`
- `.quest/mac-license-grace-states_2026-07-16__1123/phase_01_plan/review_plan-reviewer-b.md`
- `.quest/mac-license-grace-states_2026-07-16__1123/phase_02_implementation/pr_description.md`
- `.quest/mac-license-grace-states_2026-07-16__1123/phase_02_implementation/builder_feedback_discussion.md`
- `.quest/mac-license-grace-states_2026-07-16__1123/phase_03_review/review_code-reviewer-a.md`
- `.quest/mac-license-grace-states_2026-07-16__1123/phase_03_review/review_findings_code-reviewer-a.json`
- `.quest/mac-license-grace-states_2026-07-16__1123/phase_03_review/review_code-reviewer-b.md`
- `.quest/mac-license-grace-states_2026-07-16__1123/phase_03_review/review_findings_code-reviewer-b.json`

## Iterations

- Plan iterations: 2
- Fix iterations: 0

## Agents

- **The Judge** (arbiter):
- **The Implementer** (builder):

## Quest Brief

> Extend the Mac license state machine with grace and expired-reminder states.
>
> Goal:
> Implement Phase 1 of docs/implementation/mac-commercial-phase-7b-plan.md: extend
> the shipped license states in apps/macos/doc2md/Licensing/ with grace and
> expiredReminder, evaluated at moment of use from cached license state. No
> network code in this quest.
>
> Context:
> - Read AGENTS.md first.
> - Read docs/implementation/mac-commercial-phase-7b-plan.md (Phase 1 section is
>   the contract for this quest).
> - Read docs/implementation/mac-commercial-distribution-decision-record.md
>   (Licensing Mechanics section) and the V1 Interim Issuer section of
>   docs/implementation/mac-private-license-issuer-spec.md.
> - Existing surface: LicenseState.swift, LicenseVerifier.swift (5-minute clock
>   skew, hard expired result), LicenseReminderController.swift (save 10 then
>   every 25, session scoped), LicenseController.swift.
>
> Scope in:
> 1. State evaluation as a pure function of (claims, now, lastValidatedAt):
>    within 7 days before expires_at through 7 days after without successful
>    revalidation -> grace; past that window -> expiredReminder.
> 2. expiredReminder re-enables the shipped reminder cadence and exposes a
>    'licensed conveniences paused' signal for later phases.
> 3. No timers, no background jobs; expiry happens when state is next read.
> 4. Unit tests for boundary times: 8/7/1 days before expiry, expiry instant,
>    1/7/8 days after, plus existing clock-skew behavior.
>
> Scope out:
> - No network calls, no Polar client (Phase 2).
> - No Document Library (Phase 3), no purchase UX (Phase 4).
> - No change to the dormant Ed25519 verifier paths.
> - No change to core document operations under any license state.
>
> Acceptance criteria:
> - Phase 1 acceptance criteria in mac-commercial-phase-7b-plan.md, verbatim.
> - Xcode unit tests green (apps/macos/doc2mdTests).
> - npm run lint, npm run typecheck, npm test -- --run green for any touched
>   src/desktop/ surface.
> - npm run build:mac succeeds; manual File -> Open smoke passes.

## Carry-Over Findings

- No carry-over findings this round; nothing was inherited from earlier quests and nothing needs to be saved for the next one.

## Celebration

This journal embeds the celebration payload used by `/celebrate`.

- Full celebration: [`celebrations/mac-license-grace-states_2026-07-20.md`](celebrations/mac-license-grace-states_2026-07-20.md)
- [Jump to Celebration Data](#celebration-data)
- Replay locally: `/celebrate docs/quest-journal/mac-license-grace-states_2026-07-20.md`

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
      "desc": "Tackled 4 review findings"
    },
    {
      "icon": "[TEST]",
      "title": "Battle Tested",
      "desc": "Survived 4 reviews"
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
      "label": "Fix iterations: 0"
    },
    {
      "icon": "📝",
      "label": "Review findings: 4"
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
  "files_changed": 11
}
```
<!-- celebration-data-end -->
