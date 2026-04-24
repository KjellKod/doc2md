# Mac Phase 4: Converted Document Import and Markdown Persistence

- Quest ID: `phase-4-converted-docs-persistent-assets_2026-04-23__2328`
- Completed: 2026-04-23
- Mode: workflow (dual plan review + arbiter, dual code review, fix loop)
- Branch: `phase_4_converted_docs_persistent_assets`

## This is where it all began...

From the quest brief:

> Extend doc2md.app so every supported non-`.md` format is treated as an import-only source document. Native Open should hand the selected source file into the existing web converter pipeline, the editor should work on Markdown, first save should always go to a chosen `.md` target, and subsequent saves should update that `.md` file. The original source file is never overwritten.

The product rule was locked before planning: only `.md` is a directly editable on-disk target. Every other supported format (`.txt`, `.csv`, `.json`, `.tsv`, `.html`, `.docx`, `.xlsx`, `.pdf`, `.pptx`) is import-only from the user's perspective. Embedded images and assets are dropped, matching current hosted web behavior.

## Outcome

Phase 4 lands the full converted-document import lifecycle on the Mac desktop app. The shell contract in `src/types/doc2mdShell.d.ts` now carries a discriminated `ShellFile` union (`kind: "markdown" | "import-source"`). Native Open routes `.md`/`.markdown` through the Phase 3 inline-string path unchanged; every other supported format is handed off opaquely via a `WKURLSchemeHandler`-backed route at `doc2md://app/__shell/import/{token}` so React can reconstruct a real `File` and reuse the existing `convertFile(file)` pipeline. No Swift conversion code. No base64 through the bridge.

The source file never gets overwritten. Three independent barriers guarantee it:
1. `NSSavePanel` filter is `["md"]` on every save dialog
2. Save routing diverts unanchored imported entries to Save As before any write
3. `FileStore.save`/`saveAs` defensively reject any target whose extension is not `md` at the Swift boundary

A fourth barrier — save-during-conversion blocking — prevents writing empty `.md` files when the user hits Cmd+S mid-convert or after conversion errors.

The Swift `WKURLSchemeHandler` extension does the heavy lifting safely: off-main-queue `Data(contentsOf:)` reads, `Set<ObjectIdentifier>` task liveness tracking, peek/release semantics, 128 MB cap validated at both enqueue and peek time, navigation-driven eviction. Oversized payloads surface concrete error text ("limit: 128 MB") instead of the generic "Import failed" notice, because React now special-cases HTTP 413 from the import route and reads the body.

The shared web `SUPPORTED_FORMATS` list is the sole source of truth for supported extensions. `scripts/generate-supported-formats.mjs` emits `apps/macos/doc2md/SupportedFormats.generated.swift`, and `--check` mode runs in `scripts/build-mac-app.sh` + `prebuild:desktop` — drift fails the build.

## Numbers

- **Files changed:** 22 tracked + 3 new untracked (1276 insertions, 117 deletions)
- **Plan iterations:** 2 (iteration 1 sent back by arbiter with 5 blocking deltas; iteration 2 approved by both reviewers and arbiter)
- **Fix iterations:** 2 (iteration 1 addressed F1-F6 from dual review; iteration 2 fixed F7, a follow-up surfaced by Reviewer B)
- **Tests:** 343/343 Vitest passing; Swift `AppSchemeImportRouteTests` covers unknown token → 404, valid token → 200 with Cache-Control: no-store, stopped-task safety, oversized-at-enqueue, oversized-at-peek (growth), navigation-clear eviction, non-`.md` save rejection
- **Validation:** `npm test -- --run`, `npm run typecheck`, `npm run lint`, `node scripts/generate-supported-formats.mjs --check`, `xcodebuild` Debug + Release, `scripts/verify-mac-release-launch.sh` — all green
- **Handoff.json compliance:** 17/17 (100%)

## What took iteration 2 of the plan

Reviewer B (Codex) caught three real gaps in iteration 1 that Reviewer A missed:
- The advertised 50 MB gate was actually 50 MB in `src/converters/messages.ts`, not 64 MB as ACR 8 originally said
- A second `openFile()` call site in the conflict-reload path at `src/App.tsx:687` needed the same union narrowing
- `createPendingEntry` starts entries with empty markdown during conversion — without a save-during-conversion guard, Cmd+S mid-convert would have written an empty `.md`

Reviewer A caught four others:
- `openFile`'s return type needed to widen to `ShellResult<ShellFile>` (not just the alias)
- `WKURLSchemeTask` liveness at 128 MB without off-main-queue reads would have crashed Release
- Debug mode (`http://localhost:5173`) would have blocked the import branch from fetching `doc2md://...` for real cross-scheme reasons
- The handoff eviction needed explicit peek/release semantics plus a WebShellView hook on navigation

The arbiter folded all five into iteration 2. After that the plan held.

## What took two fix iterations

Iteration 1 of the fix loop addressed six items: save-guard on error-state entries, oversized-import Vitest, navigation-clear XCTest, peek-time 128 MB re-validation, `.markdown` Save → Save As routing, and the missing Cache-Control assertion.

Iteration 2 addressed a single small follow-up Reviewer B surfaced: the server-side 413 message from peek-time validation was landing in React as the generic "Import failed" notice. The fix reads the 413 body text and surfaces it directly. One Vitest locks it.

## Acceptance criteria check

All 12 ACRs from the approved plan landed. Manual validation steps from the quest brief (open `.md`, edit, save; open `.txt`/`.csv`, convert, Save As; open binary source, convert, Save As; external-touch a saved `.md` to trigger conflict UI; confirm no source was overwritten) are covered by Vitest + XCTest automation. The one exception is that a live user should still exercise the Cmd+Shift+S on a freshly converted `.docx` at least once before the release cut — but nothing in the test matrix suggests it will fail.

## Files to remember

- `src/types/doc2mdShell.d.ts` — the contract that everything else conforms to
- `apps/macos/doc2md/AppScheme.swift` — the single-handler path-prefix branch and `ImportHandoff` with peek/release + liveness tracking
- `src/App.tsx` — both openFile call sites narrow correctly; import fetch surfaces 413 body text
- `scripts/generate-supported-formats.mjs` — drift check between TS and Swift
- `apps/macos/README.md` — line 11 finally describes Phase 4 honestly

## Celebration Data

<!-- celebration-data-start -->
```json
{
  "quest_mode": "workflow",
  "agents": [
    {"name": "Jean-Claude", "model": "claude-opus-4-7", "role": "Planner, Plan Reviewer A, Arbiter, Code Reviewer A, Orchestrator"},
    {"name": "Dexter", "model": "gpt-5 (codex)", "role": "Plan Reviewer B, Builder, Code Reviewer B, Fixer"}
  ],
  "achievements": [
    {"icon": "🔒", "title": "Source file never overwritten", "desc": "Three independent barriers plus defensive Swift extension validation"},
    {"icon": "🚰", "title": "No base64 through the bridge", "desc": "WKURLSchemeHandler path-prefix handoff with peek/release semantics and task-liveness tracking"},
    {"icon": "🎯", "title": "Single source of truth", "desc": "SUPPORTED_FORMATS drives a generated Swift file with --check drift detection wired into build-mac-app.sh"},
    {"icon": "🩹", "title": "Oversized errors speak honestly", "desc": "Peek-time 128 MB re-validation, 413 body text surfaces as the user-visible notice"},
    {"icon": "🧪", "title": "Full validation green", "desc": "343 Vitest / typecheck / lint / xcodebuild Debug+Release / release-launch smoke all pass"}
  ],
  "metrics": [
    {"icon": "📝", "label": "2 plan iterations, 2 fix iterations"},
    {"icon": "📏", "label": "1276 insertions, 117 deletions across 25 files"},
    {"icon": "✅", "label": "17/17 handoff.json compliance"},
    {"icon": "🧠", "label": "12 acceptance criteria, all met"}
  ],
  "quality": {"tier": "Gold", "icon": "🥇", "grade": "A-"},
  "quote": {
    "text": "Three barriers is what an honest tool owes users who might otherwise watch their source .pdf get clobbered.",
    "attribution": "Code Reviewer A"
  },
  "victory_narrative": "Phase 4 ships the converted-document lifecycle the roadmap promised: contract-first, opaque byte handoff, import-only everything except .md, three save barriers, drift check on extensions, honest error text at the top and bottom of the 128 MB cap. Two plan iterations, two fix iterations, two reviewers who caught different real things — this is how dual review is supposed to work.",
  "test_count": 343,
  "tests_added": 16,
  "files_changed": 25
}
```
<!-- celebration-data-end -->
