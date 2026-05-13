# `ideas/` audit — 2026-05-14

Branch: `cleanup/ideas-audit-2026-05-14`

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
| `ci-trustworthiness` | **3** | **2** | `if-needed` | Real DX irritation (cubic noise, codex skipping, pr-body-gate mismatches in our recent PRs). Worth a focused half-day, not a quest. Trigger: the next PR where CI signal opacity actively slows a decision. |
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

## What changed in `ideas/README.md`

The table at the top of `ideas/README.md` is updated to reflect the new status of every audited idea. Where this audit moved an idea to archived, the README row links to the archived path; where the idea remains active with a new gut score, the README row carries a single-word status pointer back to this audit doc.

## Recommended next moves

In order of "what to pick up first":

1. **`paste-to-markdown-in-editor`** — small, additive, completes a workflow loop (LinkedIn export already exists; this is the import side).
2. **`doc2md-mac-session-restore`** — Apple-blessed APIs, data already there, just menu wiring + a JSON file.
3. **Either `preview-panel-refactor` OR the `bug_report_find_preview_table_cells` fix** — same code seam. The bug is a forcing function for at least a partial refactor.
4. **`remove-url-import`** — pure deletion; ship it the next time a related user-support friction hits.

Everything else stays in `ideas/` until a real trigger lands.
