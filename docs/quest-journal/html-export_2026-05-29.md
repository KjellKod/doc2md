# Quest Journal: HTML Export

- Quest ID: `html-export_2026-05-29__1522`
- Slug: `html-export`
- Completed: 2026-05-29
- Mode: workflow
- Quality: Platinum
- Branch: `quest/html-export` (no worktree)

## What Shipped

Single-file HTML export for doc2md, built on one shared renderer used by both the app and the npm core:

- `src/render/markdownToHtml.ts` — one pure `markdownToHtml(markdown, opts)` on `unified` + `remark-parse` + `remark-gfm` + `remark-rehype` + `rehype-slug` + `rehype-stringify` (not `marked`). Applies `formatPreviewMarkdown` as pipeline step 1 so export content matches Preview mode. No raw-HTML passthrough; images stripped; shared link classifier with `PreviewMode`.
- Standalone output: a self-contained, light-themed single file — one embedded `<style>`, no external refs/CDN/fonts/JS, no CSS `var()`, styled tables/code/task-lists, `@media print`.
- App: a quiet, visible "Export HTML" ghost button beside Save in `PreviewToolbar.tsx` (primary Save unchanged), renderer lazy-imported via `src/utils/exportHtml.ts`. Web = `text/html` blob download; desktop = native save-as `.html` that does not mutate the active Markdown document's save state/path/name (Swift `handleSaveFileAsHtml`).
- `@doc2md/core` CLI: `--format md|html|both` (default `md`); `-o` remains an output directory; collision-safe paired naming for `both`. remark/rehype deps declared explicitly and identically in root and `packages/core` manifests.
- A load-bearing parity guard test: one raw fixture through both the export renderer and the preview path.

## Pipeline

- Plan: 1 iteration. Dual review (Claude A + Codex B) + arbiter approved; 5 mechanical findings carried as a binding build backlog (parity-guard input, explicit/identical deps, manual checklist, `both` naming, desktop save-state isolation) — all satisfied by the builder.
- Build: single pass, Claude builder. typecheck clean, 751 frontend + 71 core tests green.
- Code review: dual (Claude A + Codex B), 0 blocking findings. Two info-level nits deferred as tracked debt in `.quest/backlog/deferred_findings.jsonl`.

## Notable

The builder swept Kjell's unrelated in-progress Mac P12 work (uncommitted in the tree) into a commit on a misnamed branch (`fix/mac-ci-p12-diagnostics`) alongside the HTML work. Preserved on `save/mac-p12-decode-741e4a7` and rebased out so the PR is HTML-only. Follow-up for next quest: add an early guard (branch name, dirty tree, unrelated commits) before build.

## Deferred

- Drop redundant `.html` double-validation in the Swift `handleSaveFileAsHtml` branch.
- Normalize link/image syntax out of `deriveTitleFromMarkdown` so a heading with link syntax doesn't leave bracket text in `<title>` (already HTML-escaped; cosmetic only).
