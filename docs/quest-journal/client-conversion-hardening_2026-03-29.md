# Quest Journal: Client Conversion Hardening

**Quest ID:** `client-conversion-hardening_2026-03-29__2042`
**Date:** 2026-03-29
**Mode:** workflow (full dual-review)
**Outcome:** Complete

## Summary

Audited the client-side conversion path with two goals: keep the browser queue moving when a converter hangs, and only touch output fidelity where tests or fixtures showed a real gap.

The implemented fix stayed narrow:

1. Added a hard client-side conversion timeout in `useFileConversion()` so a hung converter cannot keep a file stuck in `Queued` or `Converting` forever.
2. Added a timeout-specific warning message that tells the truth about the failure mode instead of pretending every stall is file corruption.
3. Added hook-level regression tests covering timeout failure, normal success, ignored late resolution, healthy queue progress around a single hung job, and queue recovery after timed-out jobs free slots.
4. Scoped Vitest away from nested `.quest/`, `.worktrees/`, and `.ws/` trees so repo validation reflects this app rather than embedded side workspaces.

The requested JSON/CSV/TSV/XLSX audit did not justify code changes. Their targeted suites were already green, so the quest left those converters alone rather than inventing formatting work.

## Files Changed

| File | Change |
|------|--------|
| `src/converters/messages.ts` | Added `CONVERSION_TIMEOUT_MS` and `TIMEOUT_MESSAGE` |
| `src/hooks/useFileConversion.ts` | Wrapped conversion in `Promise.race()` so hung jobs time out and free queue slots |
| `src/hooks/useFileConversion.test.ts` | Added five regression tests for timeout and queue-unblocking behavior |
| `vite.config.ts` | Excluded nested quest/worktree scratch trees from Vitest scan scope |

## Iterations

- Plan iterations: 2
- Fix iterations: 1
- Code review rounds: 2

## Review Notes

- Plan iteration 1 was rejected because a UI-only timeout would still leak the concurrency slot and leave queued work blocked.
- Plan iteration 2 corrected that by requiring timeout settlement at the promise boundary plus queue-unblocking tests.
- Code review round 1 found one should-fix gap: the queue test proved saturated timeout recovery but not the narrower case where one hung conversion sits beside healthy work.
- Fix iteration 1 added that missing test. Re-review approved clean.

## Validation

- `npm test -- --run src/hooks/useFileConversion.test.ts` → 1 file, 5 tests passing
- `npm test -- --run` → 19 files, 126 tests passing
- `npm run lint` → passed
- `npm run typecheck` → passed
- `npm run build` → passed (existing chunk-size warning only)

## Celebration Data

<!-- celebration-data-start -->
```json
{
  "quest_mode": "workflow",
  "agents": [
    {"name": "Jean-Claude", "model": "claude-opus-4-6", "role": "planner"},
    {"name": "Jean-Claude", "model": "claude-opus-4-6", "role": "plan-reviewer-a"},
    {"name": "Dexter", "model": "gpt-5.4", "role": "plan-reviewer-b"},
    {"name": "Jean-Claude", "model": "claude-opus-4-6", "role": "arbiter"},
    {"name": "Dexter", "model": "gpt-5.4", "role": "builder"},
    {"name": "Jean-Claude", "model": "claude-opus-4-6", "role": "code-reviewer-a"},
    {"name": "Dexter", "model": "gpt-5.4", "role": "fixer"}
  ],
  "achievements": [
    {"icon": "⏱️", "title": "Queue Escape Hatch", "desc": "Hung browser-side conversions now time out instead of occupying a slot forever"},
    {"icon": "🧪", "title": "Failure Mode Pinned Down", "desc": "Added focused tests for timeout, late resolution, and queue recovery behavior"},
    {"icon": "🧹", "title": "Validation Boundary Repaired", "desc": "Vitest now ignores nested quest and worktree scratch trees during repo validation"}
  ],
  "metrics": [
    {"icon": "🧪", "label": "126 tests passing"},
    {"icon": "➕", "label": "5 regression tests added"},
    {"icon": "🔄", "label": "1 fix iteration"},
    {"icon": "📁", "label": "4 product files changed"}
  ],
  "quality": {"tier": "Gold", "icon": "🥇", "grade": "B+"},
  "quote": {"text": "The added single-hung queue test closes the only open review concern.", "attribution": "Reviewer A re-review handoff"},
  "victory_narrative": "The queue was never a real backend queue. It was just a browser-side promise pool, and one stuck promise was enough to make the UI look dishonest. This quest fixed that at the boundary where it mattered and left the healthy converters alone.",
  "test_count": 126,
  "tests_added": 5,
  "files_changed": 4
}
```
<!-- celebration-data-end -->
