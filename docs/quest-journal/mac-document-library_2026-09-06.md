# Quest Journal: Mac Document Library

- Quest ID: `mac-document-library_2026-09-03__1316`
- Slug: mac-document-library
- Completed: 2026-09-06
- Mode: workflow
- Quality: Cardboard
- Celebration: [`celebrations/mac-document-library_2026-09-06.md`](celebrations/mac-document-library_2026-09-06.md)
- Outcome: `$quest "Implement Phase 3, Document Library, from docs/implementation/mac-commercial-phase-7b-plan.md. Goal: Ship the first licensed convenience for the Mac app: an unlimited, searchable history o...

## What Shipped

**Problem:** The Mac app needs its first licensed convenience, an unlimited searchable history of opened and converted documents, without changing shipped free recents, session restore, core document operations, or hosted behavior.

**User impact:** A user can open a native Document Library windo...

## Files Changed

- `.quest/mac-document-library_2026-09-03__1316/phase_01_plan/arbiter_verdict.md.next`
- `.quest/mac-document-library_2026-09-03__1316/phase_01_plan/review_findings.json.next`
- `.quest/mac-document-library_2026-09-03__1316/phase_01_plan/review_plan-reviewer-a.md`
- `.quest/mac-document-library_2026-09-03__1316/phase_01_plan/review_plan-reviewer-b.md`
- `.quest/mac-document-library_2026-09-03__1316/phase_01_plan/plan.md`
- `.quest/mac-document-library_2026-09-03__1316/phase_02_implementation/pr_description.md`
- `.quest/mac-document-library_2026-09-03__1316/phase_02_implementation/builder_feedback_discussion.md`
- `.quest/mac-document-library_2026-09-03__1316/phase_03_review/review_code-reviewer-a.md`
- `.quest/mac-document-library_2026-09-03__1316/phase_03_review/review_findings_code-reviewer-a.json`
- `.quest/mac-document-library_2026-09-03__1316/phase_03_review/review_code-reviewer-b.md`
- `.quest/mac-document-library_2026-09-03__1316/phase_03_review/review_findings_code-reviewer-b.json`
- `.quest/mac-document-library_2026-09-03__1316/phase_03_review/review_fix_feedback_discussion.md`
- `apps/macos/doc2md/DocumentLibraryWindow.swift`
- `apps/macos/doc2mdTests/DocumentLibraryWindowTests.swift`
- `.quest/mac-document-library_2026-09-03__1316/phase_03_review/review_arbiter_verdict.md.next`
- `.quest/mac-document-library_2026-09-03__1316/phase_03_review/review_findings.json.next`

## Iterations

- Plan iterations: 6
- Fix iterations: 3

## Agents

- **The Judge** (arbiter):
- **The Implementer** (builder):

## Quest Brief

`$quest "Implement Phase 3, Document Library, from docs/implementation/mac-commercial-phase-7b-plan.md.

Goal:
Ship the first licensed convenience for the Mac app: an unlimited, searchable history of opened and converted documents, while preserving all existing free-tier behavior.

Contract:
- Read AGENTS.md first.
- Read the Phase 3 section of docs/implementation/mac-commercial-phase-7b-plan.md in full.
- Read the Licensing Mechanics section of docs/implementation/mac-commercial-distribution-decision-record.md.
- Treat those decisions as locked. Do not redesign the commercial model or licensing state machine.
- Phase 1 and Phase 2 are already shipped.

Scope in:
1. Add a persistent Document Library for the Mac app:
   - document name
   - path
   - last-touched timestamp
   - search
   - one-click reopen
   - unlimited retained history
2. Build on the existing SessionStore and recent-document plumbing where appropriate.
3. Recording new entries is allowed only while the license state is licensed or grace.
4. Browsing and reopening existing entries works in every license state.
5. In expiredReminder, stop recording new entries but preserve and expose all existing entries.
6. License changes must never delete library data.
7. Keep the existing free recents list and session restore behavior byte-for-byte compatible.
8. Keep license awareness inside desktop-licensed surfaces only:
   - apps/macos/
   - src/desktop/
9. New desktop-only files must use:
   SPDX-License-Identifier: LicenseRef-doc2md-Desktop
10. Provide a clear, calm Mac-native library UX and run the repo UX review rubric.

Scope out:
- No purchase, pricing, checkout, or registration UX.
- No Polar API changes.
- No changes to the Phase 1 or Phase 2 licensing contracts.
- No license awareness in shared src/, @doc2md/core, converters, npm surfaces, or hosted web behavior.
- No conversion feature may become licensed-only.
- No cloud sync, folders, tags, previews, bulk actions, or speculative library features.
- No deletion or retention policy beyond what the Phase 3 contract requires.

Acceptance criteria:
- Licensed and grace states record new library entries.
- expiredReminder and unlicensed states do not record new entries.
- Every state can search, browse, and reopen existing entries.
- Entries survive relaunch and license-state changes.
- Nothing is deleted when a license expires, is removed, or is replaced.
- Existing free recents and session restore behavior remain unchanged.
- Duplicate/open-again behavior is deterministic and tested.
- Missing, moved, or unreadable files fail clearly without corrupting library state.
- Hosted web build output and behavior remain unchanged.
- Offline launch, open, edit, convert, save, export, library browse, and reopen continue working.
- Tests cover persistence, relaunch, gating, expiry, search, reopen, missing files, and free-tier compatibility without mocking internal logic.

Validation:
- npm run lint
- npm run typecheck
- npm test -- --run
- Xcode unit tests under apps/macos/doc2mdTests
- npm run build
- npm run build:mac
- python3 scripts/security_ci_guard.py
- Confirm hosted-web artifact behavior is unchanged.
- Manual Mac smoke: create entries, search, reopen, relaunch, change license states through test hooks, verify recording gates and retained access.
- Run /ux-review on the final Document Library surface.

Use a full Quest and an isolated worktree. Do not edit source files before Build approval. Keep this as one focused Phase 3 PR."`

## Findings Left For Future Quests

- Count: **4**
- The primary search control is a plain rounded TextField, not a macOS search field
- The library list does not refresh while the window stays open
- The production ShellHost LicenseController.state provider is still asserted only by a bridge-seam proxy, not by ShellHost itself
- Verify shared Command-W routing before fixing auxiliary-window dirty-state handling

## Celebration

This journal embeds the celebration payload used by `/celebrate`.

- Full celebration: [`celebrations/mac-document-library_2026-09-06.md`](celebrations/mac-document-library_2026-09-06.md)
- [Jump to Celebration Data](#celebration-data)
- Replay locally: `/celebrate docs/quest-journal/mac-document-library_2026-09-06.md`

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
    "background-agent": 33
  },
  "achievements": [
    {
      "icon": "[BUG]",
      "title": "Gremlin Slayer",
      "desc": "Tackled 57 review findings"
    },
    {
      "icon": "[TEST]",
      "title": "Battle Tested",
      "desc": "Survived 21 reviews"
    },
    {
      "icon": "[PLAN]",
      "title": "Plan Perfectionist",
      "desc": "Iterated plan 6 times"
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
      "label": "Plan iterations: 6"
    },
    {
      "icon": "🔧",
      "label": "Fix iterations: 3"
    },
    {
      "icon": "📝",
      "label": "Review rounds: 21"
    },
    {
      "icon": "🚌",
      "label": "Claude transport: background-agent ×33"
    }
  ],
  "quality": {
    "tier": "Cardboard",
    "grade": "C"
  },
  "inherited_findings_used": {
    "count": 0,
    "summaries": []
  },
  "findings_left_for_future_quests": {
    "count": 4,
    "summaries": [
      "The primary search control is a plain rounded TextField, not a macOS search field",
      "The library list does not refresh while the window stays open",
      "The production ShellHost LicenseController.state provider is still asserted only by a bridge-seam proxy, not by ShellHost itself",
      "Verify shared Command-W routing before fixing auxiliary-window dirty-state handling"
    ]
  },
  "test_count": null,
  "tests_added": null,
  "files_changed": 16
}
```
<!-- celebration-data-end -->
