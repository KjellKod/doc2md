# Quest: Replace xlsx with read-excel-file

**Quest ID:** replace-xlsx_2026-03-28__1746
**Completed:** 2026-03-28
**Mode:** Solo
**Plan iterations:** 1
**Fix iterations:** 0

## Summary

Replaced the abandoned `xlsx` (SheetJS) dependency with `read-excel-file` to eliminate two unpatched high-severity CVEs (prototype pollution, ReDoS). Collapsed `readWorkbook()`/`sheetToRows()` into a single `readAllSheets(file)` function. All 57 tests pass, build clean, `npm audit` reports 0 vulnerabilities.

## Files Changed

- `package.json` — swapped xlsx for read-excel-file
- `src/converters/office.ts` — replaced xlsx helpers with readAllSheets()
- `src/converters/xlsx.ts` — updated to consume new interface
- `src/converters/xlsx.test.ts` — updated mocks for new API
- `src/converters/index.test.ts` — removed xlsx import, updated mocks
- `src/__tests__/smoke.test.ts` — updated for new office.ts exports
- `vite.config.ts` — minor config adjustment

## Agents

| Role | Runtime | Model |
|------|---------|-------|
| Planner | Claude | Opus 4.6 |
| Plan Reviewer A | Claude | Opus 4.6 |
| Builder | Codex | GPT-5.4 |
| Code Reviewer A | Claude | Opus 4.6 |

## Origin

This quest originated from an idea file: `docs/ideas/replace-xlsx-with-read-excel-file.md`

This is where it all began...

> The `xlsx` (SheetJS) package has two unpatched high-severity CVEs. doc2md is client-side only so practical risk is low, but `read-excel-file` is a spot-on replacement — MIT, actively maintained, read-only, lightweight.

## Celebration Data

<!-- celebration-data-start -->
```json
{
  "quest_mode": "solo",
  "agents": [
    {"name": "Planner", "model": "claude-opus-4-6", "role": "planner"},
    {"name": "Plan Reviewer A", "model": "claude-opus-4-6", "role": "plan-reviewer-a"},
    {"name": "Builder", "model": "gpt-5.4", "role": "builder"},
    {"name": "Code Reviewer A", "model": "claude-opus-4-6", "role": "code-reviewer-a"}
  ],
  "achievements": [
    {"icon": "🛡️", "title": "CVE Slayer", "desc": "Eliminated 2 high-severity vulnerabilities"},
    {"icon": "🎯", "title": "First Try", "desc": "Plan approved in 1 iteration, code clean on first review"},
    {"icon": "📦", "title": "Dependency Surgeon", "desc": "Clean swap with zero behavior changes"}
  ],
  "metrics": [
    {"icon": "📊", "label": "7 files changed, 217 insertions, 158 deletions"},
    {"icon": "🧪", "label": "57 tests passing"},
    {"icon": "🔒", "label": "0 audit vulnerabilities"}
  ],
  "quality": {"tier": "Gold", "icon": "🥇", "grade": "A-"},
  "quote": {"text": "A boring success is underrated.", "attribution": "Dexter, 002-triage-and-turkeys"},
  "victory_narrative": "The abandoned xlsx package carried two CVEs that didn't matter much for a client-side tool but mattered enough to fix. read-excel-file dropped in clean, the fixture test confirmed identical output, and npm audit went quiet. Small work, done right.",
  "test_count": 57,
  "tests_added": 0,
  "files_changed": 7
}
```
<!-- celebration-data-end -->
