# Ideas

Index of active proposals plus a pointer to the most recent audit. The full per-idea reasoning (value, risk, gut) lives in [`../docs/ideas-audit-2026-05-14.md`](../docs/ideas-audit-2026-05-14.md).

## Active

| Gut | Idea | Notes |
|---|---|---|
| `need` | `preview-panel-refactor` | Phase 1 shipped in PR #127 (shell + 3 modes + 2 hooks + 3 flat extractions + shared rendered-surface effects module). Phase 2 (AppShell dedup of App.tsx 1306 + DesktopApp.tsx 2911) still open; brief at `ideas/quest-briefs/preview-panel-refactor-phase-2.md`. |
| `if-needed` | `doc2md-browser-crash-recovery` | Hosted-tab crash recovery via persisted drafts + stable identity. Trigger: first real-world data-loss report. |
| `if-needed` | `doc2md-mac-file-watchers` | `NSFilePresenter` live watcher. Trigger: silent overwrite from iCloud/Dropbox racing with Save. |
| `if-needed` | `pdf-multi-line-cell-tables` | Multi-line cell table detection. Trigger: customer use case where current PDF table conversion is the blocker. |
| `if-needed` | `doc2md-folder-view` | Active/Folder rail + browser FS API + Mac `chooseDirectory`. Trigger: pivot toward "doc2md is your local markdown workspace". |
| `if-needed` | `markdown-editing-and-rendering-stack` | Pipeline unification across edit/preview/read. Trigger: next time edit and preview render the same input differently. |
| `if-needed` | `remove-url-import` | Delete URL import path (still wired in `DropZone.tsx` + `remoteDocument.ts`). Trigger: next user-support thread where it's the cause. |
| `if-needed` | `doc2md-editor-engine-evaluation` | Decision doc for textarea vs CodeMirror 6 vs ProseMirror. Read before the next big editor feature. |
| `yagni` | `doc2md-multibrowser-playwright` | Firefox + WebKit in CI. Single-engine Chromium has caught everything that mattered; CI runtime would triple. |
| active | `ux-transformation` | Successor to the archived UX hardening proposal. Scores cross-surface UX work across hosted web, Mac desktop, and `@doc2md/core` with `need` / `if-needed` / `yagni`. |
| index | `mac-desktop-app-roadmap` | Planning artifact updated 2026-05-14. Phases 1–5c + 6 (MVP scope) + 7a done; **Phase 7b blocked on out-of-repo operational setup** (Cloudflare Worker, Lemon Squeezy, `doc2md.dev` DNS, support email, go-live approval). 6e/6f deferred. |
| active | `mac-commercial-distribution-and-licensing` | Phase 7b research for `doc2md.dev`, direct-DMG distribution, merchant-of-record licensing, honest-user reminders. Binding: [decision record](../docs/implementation/mac-commercial-distribution-decision-record.md). |
| `need` | `agentic-ci-scale-and-signal` | Successor to the shipped `ci-trustworthiness`. Partitioned review for large diffs, risk router (skip/light/deep), findings-to-fix verification, durable project-rules injection, Mac Swift tests in CI. See [`agentic-ci-scale-and-signal.md`](agentic-ci-scale-and-signal.md). |

## Archived (shipped or absorbed)

Pointers below link to the archive copy or to the journal entry that documents what shipped. Items listed in chronological order, most recent first.

| Archived | Idea | Shipped via |
|---|---|---|
| 2026-05-21 | ~~`ci-trustworthiness`~~ | Quest `ci-trustworthiness_2026-04-05__2258` — CI is split into named jobs, Codex review always posts visible results, review processing lives in helper scripts, and intent-review is advisory. See [archive](archive/ci-trustworthiness.md) and [quest journal](../docs/quest-journal/ci-trustworthiness_2026-04-06.md). |
| 2026-05-15 | ~~`paste-to-markdown-in-editor`~~ | Quest `paste-to-markdown_2026-05-14__2155` — editor paste now converts LinkedIn-style Unicode/basic HTML to Markdown and large hosted scratch paste enters Working Mode. See [quest journal](../docs/quest-journal/paste-to-markdown_2026-05-15.md). |
| 2026-05-15 | ~~`doc2md-mac-session-restore`~~ | Quest `ux-improvements-v2` — native recents via `NSDocumentController`, Markdown-only `session.json` restore, and native trust filtering. See [quest journal](../docs/quest-journal/ux-improvements-v2_2026-05-15.md). |
| 2026-05-14 | ~~`bug_report_find_preview_table_cells`~~ | PR #128 — `renderedTextCorpus.ts` injects virtual cell separators (space at td/th/dt/dd/li close, newline at tr/p/div/br/heading close); offset-coherent hast walk skips whitespace-only text nodes inside table/list containers. See [archive](archive/bug_report_find_preview_table_cells.md). |
| 2026-05-14 | ~~`doc2md-working-mode-chrome`~~ | PRs #121, #122 — `WorkingModeBar.tsx`, hero hide, Home affordance. See [archive](archive/doc2md-working-mode-chrome.md). |
| 2026-05-14 | ~~`doc2md-ux-hardening-proposal`~~ | Phase 1 shipped across #114, #115, #121, #122; subsequent phases promoted to standalone ideas (folder-view, mac-file-watchers, mac-session-restore, browser-crash-recovery, editor-engine-evaluation). See [archive](archive/doc2md-ux-hardening-proposal.md). |
| 2026-05-14 | ~~`actions-node24-refresh-followup`~~ | Workflows on `actions/checkout@v6` and `actions/setup-node@v6`; no Node-24 bridge env. See [archive](archive/actions-node24-refresh-followup.md). |
| 2026-05-14 | ~~`markdown_plan` (LinkedIn/Unicode preview)~~ | `src/components/linkedinFormatting.ts` + `mode === "linkedin"` in `PreviewPanel.tsx`. See [archive](archive/linkedin-unicode-preview-plan.md). |
| 2026-05-14 | ~~`resize-handle-rework`~~ | PR #115 "Split-pane resize handles" — `role="separator"` + `aria-orientation`. See [archive](archive/resize-handle-rework.md). |
| (prior) | ~~`mac-license-menu-and-about-source-visible-terms`~~ | PR #106. See [archive](archive/mac-license-menu-and-about-source-visible-terms.md). |
| (prior) | ~~`release-pinned-notice-links`~~ | PR #107. See [archive](archive/release-pinned-notice-links.md). |
| (prior) | ~~`mac-app-license-and-notice-surfacing`~~ | See [archive](archive/mac-app-license-and-notice-surfacing.md) and the [quest journal](../docs/quest-journal/mac-license-notice-surface_2026-05-04.md). |
| (prior) | ~~`doc2md-dual-licensing`~~ | PR #103. See [archive](archive/doc2md-dual-licensing.md), [license guide](../docs/licensing.md), [quest journal](../docs/quest-journal/dual-licensing-boundary_2026-05-02.md). |
| (prior) | ~~`desktop-persistence-settings`~~ | See [archive](archive/desktop-persistence-settings.md), [quest journal](../docs/quest-journal/desktop-persistence-settings_2026-04-30.md). |
| (prior) | ~~`playwright-browser-baseline`~~ | See [quest journal](../docs/quest-journal/playwright-browser-baseline_2026-05-02.md). |
| (prior) | ~~`ci-review-hardening-patterns`~~ | See [quest journal](../docs/quest-journal/ci-review-hardening_2026-04-08.md). |
| (prior) | ~~`idea-pdf-quality-signals-and-warnings`~~ | See [quest journal](../docs/quest-journal/pdf-quality-signals_2026-03-30.md). |

## Audit doc

[`../docs/ideas-audit-2026-05-14.md`](../docs/ideas-audit-2026-05-14.md) — full per-idea scoring rationale.
