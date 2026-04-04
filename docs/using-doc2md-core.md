# Using `@doc2md/core`

`doc2md` now has two paths:

- The live browser app at `https://kjellkod.github.io/doc2md/` for private, local-first conversion in the browser
- The `@doc2md/core` package for Node, CLI, batch jobs, MCP tools, and other automation flows

## Current Install Story

`@doc2md/core` exists in this repository as a workspace package at [`packages/core/`](../packages/core/).

Today, the clean-consumer path is:

1. Build the package
2. Pack it or install it from the local workspace/repo
3. Call the API or CLI from your own Node environment

Example from this repo:

```bash
npm run build --workspace=@doc2md/core
cd packages/core
npm pack
```

That produces a tarball you can install in another project with `npm install /path/to/doc2md-core-0.1.0.tgz`.

## API

### Batch conversion

```ts
import { convertDocuments } from "@doc2md/core";

const result = await convertDocuments(
  [
    "/absolute/path/resume.pdf",
    "/absolute/path/notes.docx",
    "/absolute/path/sheet.xlsx",
  ],
  {
    outputDir: "/absolute/path/out",
    maxDocuments: 25,
    concurrency: 4,
  },
);

console.log(result.summary);
console.log(result.results);
```

### Single-document conversion

```ts
import { convertDocument } from "@doc2md/core";

const result = await convertDocument("/absolute/path/resume.pdf", {
  outputDir: "/absolute/path/out",
});

console.log(result);
```

## What The API Returns

The package writes markdown files to disk and returns metadata, not inline markdown content.

Each result row includes:

- `inputPath`
- `outputPath`
- `status`: `success`, `warning`, `skipped`, or `error`
- `warnings`
- optional `quality`
- optional `error`
- `durationMs`

Batch output also includes a `summary` with totals for succeeded, warned, skipped, failed, and total duration.

## Failure And Skip Behavior

- Unsupported files are skipped and do not fail the batch
- Supported but unreadable/bad inputs return `status: "error"` for that document
- Exceeding `maxDocuments` throws `BatchLimitExceededError`
- Duplicate basenames are written with numeric suffixes like `resume.md`, `resume-1.md`, `resume-2.md`

## CLI

```bash
doc2md /absolute/path/a.pdf /absolute/path/b.docx -o /absolute/path/out
```

Optional flags:

- `--max <n>`
- `--concurrency <n>`

The CLI writes batch JSON to stdout and markdown files to the output directory.

## Good Fits

`@doc2md/core` is a good fit when you want:

- resume screening or ingestion pipelines
- MCP/server-side pre-processing before handing content to an LLM or agent
- batch document-to-markdown conversion in a Node tool
- a reusable extraction layer that stays aligned with the browser app's converters

## Important Boundaries

- This package is Node-focused, not browser-focused
- It reuses the shared converters from `src/converters/`
- The browser app remains the easiest path for one-off interactive conversion and review
- The package defaults to file-based output; if a future consumer needs inline markdown in the result object, that would be follow-up work
