# Plan brief: HTML export (single-file) for the app and `@doc2md/core`

Status: design brief, pre-implementation. This is the seed for the Quest planning
phase, not the final implementation plan. The Quest planner should expand,
challenge, and correct it against the live code.

## Problem

doc2md converts documents to Markdown and shows a live preview. Users (and
increasingly, agents that generate docs) want the output as **HTML** too, not
just Markdown. We previously declined PDF export; HTML is different because the
preview is already rendered HTML, so the marginal cost is low and the parity
story is strong.

## Goal

Let a user/agent obtain a **single self-contained `.html` file** of the converted
document, in two places:

1. **App** (web + desktop): a quiet, visible "Export HTML" action next to Save.
2. **`@doc2md/core` CLI**: a `--format md|html|both` flag (default `md`).

Both must produce **identical** HTML, because they call **one shared renderer**.

## Non-goals

- No PDF export.
- No image embedding. Images are **intentionally stripped** during conversion
  (`src/converters/office.ts:12` `stripImageTags`; DOCX/PDF count + warn via
  `src/converters/messages.ts:21`). The Markdown is image-free by design, so the
  HTML is trivially self-contained. Do not add image inlining.
- No redefinition of the CLI `-o` flag: it is an **output directory** for batch
  conversion (`packages/core/src/cli-options.ts`), not a single file. HTML is a
  new `--format` flag, not a change to `-o`.
- No theme switching in the export. Export is always light/white background with
  dark text regardless of the app's current theme.

## Architecture decision (the important one)

`src/converters/` is the **single source of truth**; both the React app and
`@doc2md/core` import it (`packages/core/src/batch.ts:1` →
`../../../src/converters`). The missing capability — Markdown → HTML as a Node-
and browser-safe **string function** — is missing on *both* sides today (the app
only has `react-markdown`, a React component; core has nothing).

**Add one shared pure function** in the shared `src/` layer (proposed:
`src/render/markdownToHtml.ts`, Quest planner to confirm location):

```ts
markdownToHtml(markdown: string, opts?: {
  standalone?: boolean;   // default true → full <!DOCTYPE html> doc; false → body fragment
  title?: string;         // <title>, derived from filename/first heading
}): string
```

- **App "Export HTML"** calls it → clean **re-render** from stored Markdown. This
  deliberately rejects scraping the live preview DOM (`previewElement.innerHTML`),
  which carries editor-only cruft: `data-source-line` attributes
  (`sourceLineRehype`), find-highlight `<mark>` wrappers, disabled-link tooltip
  span wrappers (`PreviewMode.tsx:117`), and slug ids tied to find/scroll.
- **CLI** calls the same function and writes `name.html`.
- **Parity is guaranteed** because it is literally the same function.

### Engine: remark/rehype, NOT `marked`

The preview is `react-markdown` (remark-based) with `remark-gfm` + `rehype-slug`.
To keep export == preview, build the string pipeline on the same family:
`unified` + `remark-parse` + `remark-gfm` (already a dep) + `remark-rehype` +
`rehype-stringify`, plus `rehype-slug` (already a dep). These are tiny and
isomorphic (Node + browser). `marked` would drift on GFM table/footnote edge
cases — reject it. The shared `formatPreviewMarkdownWithLineMap`
(`src/components/previewFormatting.ts`) is editor-only (line maps); the export
should use the **same source Markdown normalization the preview applies** minus
the line-map machinery. Quest planner: verify which preview transforms are
content-affecting (should be mirrored) vs editor-only (must be excluded), so
export visually matches Preview mode.

App bundle: lazy-import the renderer on the export path so initial load does not
grow.

## Self-contained HTML artifact spec

- `<!DOCTYPE html>`, `<html lang>`, `<meta charset="utf-8">`,
  `<meta name="viewport" ...>`, `<title>`.
- **One embedded `<style>` block.** No external links, no CDN, no remote fonts,
  no JS. Hand-authored export stylesheet (do NOT ship the app's `global.css`).
- Forced **light/white background, dark text**. Constrain body width
  (~700–800px, centered), generous line-height (~1.6).
- Explicit styles for headings, lists, **task lists**, blockquotes, **tables**,
  and **code blocks** (tinted background, padding, rounded corners,
  `overflow-x:auto`, `white-space: pre`).
- System font stack for body/code (no web-font downloads).
- Resolve CSS custom properties to literal values — the app's prose CSS uses
  `var(--text-primary)` etc. defined only at `:root`; the export stylesheet must
  bake real values, not `var()`.
- `@media print` niceties (`img { max-width:100% }`, sensible margins) since HTML
  exports are often printed/saved-to-PDF by the recipient.
- Escaping/sanitization: rely on the remark/rehype pipeline's HTML-safe output;
  confirm no raw-HTML passthrough enables injection from untrusted Markdown.

## App UX

- Keep `Save` (Markdown) as the **primary** one-click action, unchanged.
- Add a **quiet, visible** "Export HTML" button beside Save in the preview
  toolbar (`src/components/preview/PreviewToolbar.tsx`), styled ghost/secondary
  so it reads as optional. Rationale over a split-button caret: usability data
  shows up to ~80% of users never click the caret, which fails the "still
  visible" requirement. Reserve a fan-out menu / dialog for the future moment a
  third format or per-export options appear.
- **Web**: blob download, mirroring `src/utils/download.ts` (the `.md` path).
- **Desktop**: native save dialog, mirroring `desktopAdapter.tsx` `handleSaveAs`
  (`shell.saveFileAs`), defaulting to a `.html` extension.
- Filename: derive from the source like the Markdown filename helper, swapping
  the extension to `.html`.
- Gate visibility the same way the copy/save controls are gated (entry success/
  warning, non-empty content).

## CLI / core

- `packages/core/src/cli-options.ts`: add `--format md|html|both` (default `md`),
  validated like other flags; update `--help` text.
- `packages/core/src/batch.ts` (or the write path in `io.ts`): when format
  includes `html`, render via the shared `markdownToHtml(md, { standalone: true,
  title })` and write `name.html` alongside/instead of `name.md` into the output
  dir. `both` writes both files.
- Update `@doc2md/core` README/usage and the app's InstallPage/AboutSection copy
  if they enumerate CLI flags.
- Note: `@doc2md/core` identity widens from "document → markdown" to
  "document → markdown, optionally → clean HTML." Positioned as an output format
  of the same conversion, not a new product.

## Testing

- Unit: `markdownToHtml` over fixtures (headings, GFM tables, task lists, code
  fences, blockquotes, links — external vs in-doc, inline code). Snapshot the
  standalone doc and the fragment.
- **Parity check**: a fixture rendered through the export pipeline structurally
  matches what Preview mode produces for the same Markdown (same block/inline
  structure; editor-only attributes excluded). Encode this as a guard test so
  preview and export cannot silently drift.
- App: button renders/gates correctly; web triggers a blob download with the
  right filename + `text/html`; desktop calls the save-as bridge with `.html`.
- CLI: `--format` parsing (valid/invalid/default); batch writes the expected
  `.html` / `both` outputs; bad value errors clearly.
- Run the existing suites in app and `packages/core`; run `npm ci` first if
  install looks stale before treating any failure as baseline.

## Risks / watch-items

- **Preview/export drift** if transforms diverge — mitigated by the shared
  function + parity test.
- **Bundle growth** in the app — mitigated by lazy import.
- **Disabled/in-doc links**: the preview renders repo-relative links as disabled
  with a tooltip wrapper; in a standalone HTML file there is no in-app resolver.
  Decide: render such links as plain text, as a normal `<a>` with the original
  href, or styled-disabled. (Open decision below.)
- **Slug ids**: harmless and useful in export (anchor links); keep `rehype-slug`.

## Acceptance criteria

1. One shared `markdownToHtml()` used by both app and CLI; no second renderer.
2. App: "Export HTML" beside Save, primary Save unchanged; works on web (blob)
   and desktop (native save), `.html` filename.
3. Exported file is single, self-contained, light-themed, no external refs,
   opens cleanly offline; tables/code/task-lists styled.
4. CLI: `--format md|html|both` (default `md`) writes correct outputs; help +
   docs updated.
5. Export structurally matches Preview mode (parity test green).
6. All tests pass; no image inlining added; `-o` semantics unchanged.

## Open decisions for the Quest planner

1. Final location/name of the shared module (`src/render/markdownToHtml.ts`?) and
   where the export stylesheet string lives (co-located vs `src/render/`).
2. Exact handling of in-doc / disabled links in the standalone artifact.
3. Whether to ship `--format both` in the first PR or defer it to keep PR #1
   lean (app feature + `md|html` first).
4. Whether the standalone wrapper + CSS lives in shared `src/` (so the CLI emits
   styled HTML directly) or whether core emits a fragment and only the app
   styles — recommendation: shared, so the CLI output is useful standalone.
5. Which preview Markdown transforms are content-affecting and must be mirrored.
</content>
