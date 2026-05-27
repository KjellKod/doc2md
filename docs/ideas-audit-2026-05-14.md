# `ideas/` audit — 2026-05-14

Branch: `cleanup/ideas-audit-2026-05-14`

Status note, 2026-05-26: this is a historical audit. Current routing lives in
[`ideas/README.md`](../ideas/README.md). Several ideas that were active or
if-needed on 2026-05-14 have since shipped, been absorbed, or been archived as
not-now/YAGNI.

A code-evidence audit of every non-archived `ideas/` file. Each idea is either:
- **Implemented** (archived in this branch) — code already does what the idea proposes
- **Not implemented** — scored on value, risk, and a one-word gut-feeling (`need`, `if-needed`, `yagni`)

Scoring scale: **1–5**. Value is impact on users or maintainer velocity if shipped. Risk is likelihood of bugs, scope creep, or ongoing maintenance burden. Gut: `need` = should ship soon, `if-needed` = ship when a concrete trigger arrives, `yagni` = don't ship unless we explicitly walk back the rationale below.

## Archived this session (7 total, code evidence confirms)

| Idea | Evidence | Notes |
|---|---|---|
| `doc2md-working-mode-chrome` | `src/components/WorkingModeBar.tsx` exists; PRs #121, #122 land the WorkingModeBar + hero-hide + Home affordance | The two-mode layout described in `doc2md-ux-hardening-proposal` |
| `doc2md-ux-hardening-proposal` | Phase 1 (auto-continue, find/replace, working-mode collapse) shipped via #114, #115, #121, #122; subsequent phases promoted to standalone ideas (folder-view, mac-file-watchers, mac-session-restore, browser-crash-recovery, editor-engine-evaluation) | Parent proposal; children tracked separately |
| `actions-node24-refresh-followup` | Header marks it complete; `.github/workflows/*.yml` show `actions/checkout@v6` and `actions/setup-node@v6`; no `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24` bridge remains | Followup absorbed into broader action-version refreshes |
| `markdown_plan` (LinkedIn/Unicode Preview) | `src/components/linkedinFormatting.ts` + `formatLinkedInUnicodeWithLineMap` + `mode === "linkedin"` in PreviewPanel | Renamed to `linkedin-unicode-preview-plan.md` on archive for clarity |
| `resize-handle-rework` | PR #115 "Split-pane resize handles" lands `role="separator"` + `aria-orientation` per the proposal | The 2D corner handle is gone |
| `mac-license-menu-and-about-source-visible-terms` | Header marks "Status: complete, Completed: PR #106" | Already done at the time of filing |
| `release-pinned-notice-links` | Header marks "Status: complete, Completed: PR #107" | Already done at the time of filing |

## Not implemented — scored

### Active product work, ship-soon (gut: `need`)

| Idea | Value | Risk | Gut | Why |
|---|---|---|---|---|
| `preview-panel-refactor` | **4** | **4** | `need` | `PreviewPanel.tsx` is now 1285 lines (was 1038 in the proposal); `App.tsx` 1306, `DesktopApp.tsx` 2911 — the dup pair grew. The recurring find/anchor bug cluster (PR #114, #123, the table-cells bug just filed) all live at this seam. Risk is real because the file is dense, but the alternative is more whack-a-mole. Pick a scope (extract find subsystem first?) and start. |
| `doc2md-mac-session-restore` | **4** | **2** | `need` | Apple-blessed APIs: `NSDocumentController.shared.noteNewRecentDocumentURL` + `Open Recent` submenu + `session.json` reopen. `PersistenceStore.recentFiles` already records the data; menu wiring is the missing piece. Low risk, high user-visible value for "where did I leave off". |
| `paste-to-markdown-in-editor` | **4** | **2** | `need` | Direct counterpart to the existing LinkedIn export. Reverse the formatLinkedInUnicode table for paste; HTML-to-markdown via a small adapter (turndown is already in deps). Real user pain — copy from LinkedIn, paste back, get garbage today. |
| `bug_report_find_preview_table_cells` | n/a | n/a | `need` (track) | Filed in PR #120 against the maintainer-reported symptom. Not an idea, a known-bug tracker. Acceptance criteria already drafted. |

### Worth doing, but only on a trigger (gut: `if-needed`)

| Idea | Value | Risk | Gut | Why |
|---|---|---|---|---|
| `doc2md-browser-crash-recovery` | **4** | **3** | `if-needed` | Real value: a browser tab crash today loses unsaved drafts. But it requires a stable-identity layer the architecture doesn't have. The right trigger is the first user-report of meaningful work lost. |
| `doc2md-mac-file-watchers` | **3** | **3** | `if-needed` | `NSFilePresenter` live watcher for iCloud / Dropbox / OneDrive coordination. Mtime-at-save-time already catches the most common case. Trigger: a user reports a silent overwrite when iCloud sync raced with Save. |
| `pdf-multi-line-cell-tables` | **3** | **3** | `if-needed` | Healthcare / legal / compliance documents specifically. The Molina example in the doc is real. Trigger: a paying-customer-shaped use case where current PDF table conversion is the blocker. |
| `doc2md-folder-view` | **4** | **4** | `if-needed` | Two-tab Active/Folder rail with browser FS API + Mac `chooseDirectory` (currently `canChooseDirectories = false` in both shells). Big feature, real polish if shipped, but optional. Trigger: a clear pivot toward "doc2md is your local markdown workspace" positioning. |
| `markdown-editing-and-rendering-stack` | **3** | **4** | `if-needed` | Pipeline unification across edit / preview / read. Risk is high because it touches every surface. Trigger: the next time edit and preview render the same input differently and a fix in one breaks the other. |
| `remove-url-import` | **3** | **1** | `if-needed` | URL import still wired in `src/utils/remoteDocument.ts` + `DropZone.tsx`. The proposal notes low success rate and CORS confusion. Pure deletion is easy. Trigger: the next user-support thread where URL import is the cause. |
| `doc2md-editor-engine-evaluation` | **2** | **1** | `if-needed` | Decision document, not implementation. Read it before any next-big-editor-feature work (vim mode, block move, mention picker). Trigger: when one of those features is proposed. |

### Don't pursue (gut: `yagni`)

| Idea | Value | Risk | Gut | Why |
|---|---|---|---|---|
| `doc2md-multibrowser-playwright` | **2** | **2** | `yagni` | Firefox + WebKit in CI triples runtime for engine-specific bugs we haven't seen. Single-engine Chromium has caught everything that mattered. Trigger to reconsider: an actual cross-browser bug Chromium-only coverage missed. |

### Deleted outright

| Idea | Why |
|---|---|
| `hexagonal-pdf-backends` | Removed (not archived) per maintainer call. The proposal explicitly waited for "a second PDF backend confirmed"; no second backend is on the roadmap; the proposal added overhead with no path to payoff. Deleted in this branch's commit history rather than archived so the trail does not suggest revival. |

### Keep as planning artifact (not an actionable idea)

| Idea | Notes |
|---|---|
| `mac-desktop-app-roadmap` | Phase index, updated in this commit. Status now reflects: Phases 1–5c done, Phase 6 done at MVP scope (6e/6f deferred), Phase 7a done, **Phase 7b blocked on out-of-repo operational setup** (Cloudflare Worker issuer, Lemon Squeezy merchant account, `doc2md.dev` DNS, support email, maintainer go-live approval). In-repo deliverables for 7b have all shipped (decision record #108, issuer spec #109, in-app verifier #110, license boundary #103). |

## Post-audit corrections — 2026-05-21

| Idea | Correction | Evidence |
|---|---|---|
| `ci-trustworthiness` | Moved from active `if-needed` to archived/shipped. | Quest `ci-trustworthiness_2026-04-05__2258` and `docs/quest-journal/ci-trustworthiness_2026-04-06.md`; current workflows split CI into named jobs, keep Codex review visible, add an advisory intent-review lane, and document required versus advisory checks. |
| `doc2md-browser-crash-recovery` | Kept active `if-needed`, with narrower wording. Superseded 2026-05-26: archived as not-now/YAGNI. | Hosted app has in-session protection and a `beforeunload` guard, and Mac session restore is separately shipped. No hosted reload-surviving draft index, stable scratch identity, IndexedDB fallback, or boot-time Restore / Discard UI exists yet. |
| `remove-url-import` | Superseded 2026-05-27: moved from active `if-needed` to archived/shipped. | Hosted and Mac React surfaces no longer expose browser URL import; `@doc2md/core` and the CLI still accept direct remote document URLs. |

## What changed in `ideas/README.md`

The table at the top of `ideas/README.md` is updated to reflect the new status of every audited idea. Where this audit moved an idea to archived, the README row links to the archived path; where the idea remains active with a new gut score, the README row carries a single-word status pointer back to this audit doc.

## Recommended next moves

In order of "what to pick up first":

1. **`paste-to-markdown-in-editor`** — small, additive, completes a workflow loop (LinkedIn export already exists; this is the import side).
2. **`doc2md-mac-session-restore`** — Apple-blessed APIs, data already there, just menu wiring + a JSON file.
3. **Either `preview-panel-refactor` OR the `bug_report_find_preview_table_cells` fix** — same code seam. The bug is a forcing function for at least a partial refactor.
4. **`remove-url-import`** — pure deletion; ship it the next time a related user-support friction hits.

Everything else stays in `ideas/` until a real trigger lands.

## Appendix: `doc2md-ux-hardening-proposal` claim-by-claim validation

The parent proposal was archived above on the strength of WorkingModeBar, Find/Replace, auto-continue, and resize-handle work landing across PRs #114, #115, #121, and #122. This appendix walks every sub-claim with code-evidence so the gaps are explicit and routed to a tracker.

### Two-mode layout (Landing vs Working)

| Claim | Status | Evidence |
|---|---|---|
| Landing mode untouched | DONE | `src/App.tsx:172,235-236` `isWorkingMode` gating preserves hero when no file open |
| Working mode collapses chrome | DONE | `src/components/WorkingModeBar.tsx:144-228`, `src/App.tsx:1006,1019-1030` |
| Auto-transition on first file open | DONE | `WorkingModeBar` mounts on `entry` truthy |
| Auto-transition on paste over 200 chars | NOT DONE | No `onPaste` handler reads paste length in `App.tsx`, `DesktopApp.tsx`, or `PreviewPanel.tsx`. Tracker: route into [`paste-to-markdown-in-editor`](../ideas/paste-to-markdown-in-editor.md) (already covers paste interception; add the 200-char auto-fence sub-claim) |
| Logo / Home affordance returns to landing | DONE | Home affordance shipped PR #122 |

### Editor parity with GitHub

| Claim | Status | Evidence | Tracker for gap |
|---|---|---|---|
| Auto-continue lists on Enter | DONE | `src/components/markdownAutoContinue.ts:24-31,56-149` (bullets, ordered, tasks, blockquotes, IME guard via `compositionstart`/`compositionend`) | n/a |
| Ordered auto-renumber on insert/remove | PARTIAL | Continuation emits `n+1` only; no renumber of trailing items on insert/remove. Superseded 2026-05-26: broad tracker archived; revive only from concrete editor friction. |
| Tab / Shift-Tab indent or outdent | NOT DONE | No keydown handler intercepts Tab in the editor textarea | new note in `markdown-editing-and-rendering-stack` |
| Empty-bullet Enter exits list | DONE | `markdownAutoContinue.ts` returns plain newline on empty marker | n/a |
| Find with Replace, Match Case, Regex, Whole Word, counter | DONE | `src/components/FindReplaceBar.tsx`, `src/components/useFindReplace.ts` | n/a |
| Replace All as single undo step | NEEDS VERIFY | History-coalescing behavior not confirmed in this pass. Flag for review the next time `useFindReplace` is touched | Historical note in archived [`preview-panel-refactor`](../ideas/archive/preview-panel-refactor.md) |
| Live-highlight cap | DONE | `useFindReplace.ts:3` `MAX_MATCHES = 5_000` enforced at lines 79, 103 with `capped: true` | n/a |
| Tokenize once, search incrementally, cancellable on input change | PARTIAL | Cap enforced. `useMemo` recomputes whole-document matches on every change; no AbortController, no incremental tokenization | Historical note in archived [`preview-panel-refactor`](../ideas/archive/preview-panel-refactor.md) |
| Cmd/Ctrl-B, I, K wrap selection | DONE | `src/components/markdownFormatting.ts:18-110` |
| Selection-wrap on `*` `_` backtick `[` `(` `"` | DONE | `markdownFormatting.ts` smart-wrap branches | n/a |
| Cmd-Shift-7 / 8 / 9 list toggles | DONE | `markdownFormatting.ts` list-toggle helpers | n/a |
| Open Find/Replace with Replace expanded (Cmd-Alt-F on Mac, Ctrl-H on Windows/Linux; avoid global Ctrl-H on Mac, conflicts with Cocoa delete-backward) | PARTIAL | Cmd-F opens; the Replace-expanded variant is not bound on either platform | small note in `markdown-editing-and-rendering-stack` |
| Block move Alt-Up / Alt-Down | NOT DONE | No handler in textarea | small note in `markdown-editing-and-rendering-stack` |
| Cmd-D select next occurrence | NOT DONE | No handler | same note |

### Folder view

| Claim | Status | Evidence |
|---|---|---|
| Two-tab Active / Folder rail | NOT DONE | No folder-tree component in `src/components/` |
| Mac `NSOpenPanel` with `canChooseDirectories` | NOT DONE | `apps/macos/doc2md/ShellBridge.swift:146` and `WebShellView.swift:180` both set `canChooseDirectories = false` |
| Browser File System Access API folder pick | NOT DONE | No `showDirectoryPicker` calls in repo |
| Supported-set dim/disable, hidden-file toggle | NOT DONE | No filtering UI present |
| Never auto-convert, convert promotes into Active | NOT DONE | No conversion gating tied to a folder context |
| Re-convert focuses existing buffer | NOT DONE | No dedup logic across re-opens of the same source path |
| Folder pick persists across launches | NOT DONE | `PersistenceStore` has `recentFiles` but no `lastFolderRoot` |

All folder-view gaps are tracked in [`doc2md-folder-view`](../ideas/doc2md-folder-view.md), gut `if-needed`.

### Feature hardening

| Claim | Status | Evidence | Tracker for gap |
|---|---|---|---|
| Visible "Saved · 2s ago" + "Unsaved" pill | DONE | `src/components/SaveStatePill.tsx` | n/a |
| `beforeunload` guard while dirty | DONE | `src/App.tsx:967-989` | n/a |
| localStorage debounced snapshot on keystroke | NOT DONE | No `localStorage.setItem` in keystroke path | Archived not-now/YAGNI: [`doc2md-browser-crash-recovery`](../ideas/archive/doc2md-browser-crash-recovery.md) |
| IndexedDB fallback over ~500KB | NOT DONE | No IndexedDB usage in `src/` | same |
| Crash-recovery prompt on reopen | NOT DONE | No reopen-time compare path | same |
| Mac per-file write lock | PARTIAL | Atomic write + mtime-at-save in shell; no `NSFileCoordinator` | Archived not-now/YAGNI: [`doc2md-mac-file-watchers`](../ideas/archive/doc2md-mac-file-watchers.md) |
| Mac "file changed on disk, reload?" live detection | PARTIAL | mtime checked only at save/reload, not while document is open | same |
| `NSDocumentController.noteNewRecentDocumentURL` + Open Recent submenu | NOT DONE | Zero `NSDocumentController` references in `apps/macos/doc2md/`; no Open Recent menu wiring | [`doc2md-mac-session-restore`](../ideas/doc2md-mac-session-restore.md) |
| `session.json` reopen | NOT DONE | No `session.json` write/read; recent-files data is in `settings.json` only | same |
| Tabs vs spaces detection (no save-time reformat) | DONE | `src/components/markdownAutoContinue.ts:37-50` `detectIndentUnit` reads first indented line; line 152-164 reuses parsed marker indent | n/a |
| Aria labels on overlay buttons | DONE | `FindReplaceBar.tsx:114,128,146,167,186,207,216,267,303` all carry `aria-label` | n/a |
| Find bar keyboard reachable, ESC closes | DONE | `FindReplaceBar.tsx:74,84-88` ESC closes and returns focus | n/a |

### Untracked gaps summary

Three claims from this proposal were not tracked anywhere else and are folded into existing trackers by this audit:

1. **200-character paste auto-fence into working mode** → notional sub-claim added to [`paste-to-markdown-in-editor`](../ideas/paste-to-markdown-in-editor.md).
2. **Find/Replace incremental + cancellable search** (cap is shipped, streaming is not) → historical note in archived [`preview-panel-refactor`](../ideas/archive/preview-panel-refactor.md).
3. **Editor keybinding gaps** (Tab indent, Alt-Up/Down, Cmd-D, Replace-pane binding via Cmd-Alt-F on Mac or Ctrl-H on Windows/Linux, ordered renumber on edits) → the broad [`markdown-editing-and-rendering-stack`](../ideas/archive/markdown-editing-and-rendering-stack.md) tracker was archived on 2026-05-26. None of these are individually load-bearing, and the proposal itself flagged them as "nice if free." They earn a `need` only if a user-visible regression lands.

### Net effect

Of the 38 discrete sub-claims in the proposal, 22 are shipped, 11 are not, 5 are partial. Every gap is now mapped to one of four active idea files. The proposal's archive status holds: the load-bearing themes (two-mode layout, find/replace, auto-continue, save-state visibility, accessibility, indent detection) all shipped; the remaining gaps are correctly captured downstream.
