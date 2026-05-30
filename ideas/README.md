# Ideas

Index of active proposals plus a pointer to the most recent audit. The full per-idea reasoning (value, risk, gut) lives in [`../docs/ideas-audit-2026-05-14.md`](../docs/ideas-audit-2026-05-14.md).

## Active

| Gut | Idea | Notes |
|---|---|---|
| `if-needed` | `pdf-multi-line-cell-tables` | Multi-line cell table detection. Trigger: customer use case where current PDF table conversion is the blocker. |
| `if-needed` | `doc2md-folder-view` | Active/Folder rail + browser FS API + Mac `chooseDirectory`. Trigger: pivot toward "doc2md is your local markdown workspace". |
| index | `mac-desktop-app-roadmap` | Planning artifact updated 2026-05-28. Phases 1–5c + 6 (MVP scope) + 7a done; **Phase 7b blocked on out-of-repo operational setup** (Cloudflare Worker, Lemon Squeezy, `doc2md.dev` DNS, support email, go-live approval). |
| active | `mac-commercial-distribution-and-licensing` | Phase 7b research for `doc2md.dev`, direct-DMG distribution, merchant-of-record licensing, honest-user reminders. Binding: [decision record](../docs/implementation/mac-commercial-distribution-decision-record.md). |
| `need` | `agentic-ci-scale-and-signal` | Successor to the shipped `ci-trustworthiness`. Partitioned review for large diffs, risk router (skip/light/deep), findings-to-fix verification, durable project-rules injection, Mac Swift tests in CI. See [`agentic-ci-scale-and-signal.md`](agentic-ci-scale-and-signal.md). |
| `active` | `startup-tips-harness` | Generalize the one-off "default Markdown app" hint into a small startup-tips registry: id-keyed per-tip dismissal, required headline, native storage, a reversible "Show startup tips" master toggle in Settings (via ShellBridge). Surfaced by PR #166. See [`startup-tips-harness.md`](startup-tips-harness.md). |
| `active` | `settings-recent-file-typography` | Tone down the bold/large recent-file filename in the Settings panel so it reads as a quiet list as Settings grows. Tiny CSS/markup change. See [`settings-recent-file-typography.md`](settings-recent-file-typography.md). |
| `if-needed` | `quest-skill-improvements-2026-05-29` | Process proposals from the PR #166 quest run: code-review arbiter, enforce canonical findings JSON, pre-PR sync-base + reinstall gate, repo-hard-convention decision floor, per-phase bookkeeping helper, force-push gate, codex-review skip-on-quota. See [`quest-skill-improvements-2026-05-29.md`](quest-skill-improvements-2026-05-29.md). |

## Archived (shipped or absorbed)

Pointers below link to the archive copy or to the journal entry that documents what shipped. Items listed in chronological order, most recent first.

| Archived | Idea | Shipped via |
|---|---|---|
| 2026-05-28 | ~~`remove-url-import`~~ | The hosted/desktop remote-fetch affordance was removed because browser fetch/CORS behavior made it unreliable. Core/CLI remote URL support remains. See [archive](archive/remove-url-import.md). |
| 2026-05-26 | ~~`ux-transformation`~~ | Roadmap completed or deliberately deferred: workspace density #141, theme/tooltips #143, onboarding/error/empty copy #144, keyboard shortcuts #146, paste routing #150, mobile layout #151/#152. Remaining speculative items stay gated by concrete triggers. See [archive](archive/ux-transformation.md). |
| 2026-05-26 | ~~`preview-panel-refactor`~~ | Phase 1 shipped in PR #127 and Phase 2 AppShell dedup shipped in PR #135. Quest briefs archived with the proposal. See [archive](archive/preview-panel-refactor.md). |
| 2026-05-26 | ~~`markdown-editing-and-rendering-stack`~~ | Archived as absorbed/obsolete. The real editor and preview stack now lives in `src/components/preview/`, `react-markdown` + `remark-gfm`, focused paste/copy tests, and the bounded shortcut reference from PR #146. See [archive](archive/markdown-editing-and-rendering-stack.md). |
| 2026-05-26 | ~~`doc2md-editor-engine-evaluation`~~ | Archived as YAGNI. The textarea remains the right editor until concrete heavier editor features justify an engine switch. See [archive](archive/doc2md-editor-engine-evaluation.md). |
| 2026-05-26 | ~~`doc2md-mac-file-watchers`~~ | Archived as not-now/YAGNI. Save-time and reload-time mtime conflict handling are enough until a real synced-folder overwrite report appears. See [archive](archive/doc2md-mac-file-watchers.md). |
| 2026-05-26 | ~~`doc2md-multibrowser-playwright`~~ | Archived as YAGNI. Current named Playwright coverage is sufficient for now; revive only after a real non-Chromium bug escapes. See [archive](archive/doc2md-multibrowser-playwright.md). |
| 2026-05-26 | ~~`doc2md-browser-crash-recovery`~~ | Archived as not-now/YAGNI. Hosted browser has dirty-navigation protection via `beforeunload`; persisted unsaved draft recovery is intentionally out of scope until real data-loss evidence justifies it. See [archive](archive/doc2md-browser-crash-recovery.md). |
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
