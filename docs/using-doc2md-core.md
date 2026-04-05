# Using `@doc2md/core`

`doc2md` now has three practical paths:

- the live browser app at `https://kjellkod.github.io/doc2md/` for private, local-first conversion in the browser
- the `@doc2md/core` package for Node, batch jobs, MCP tools, and automation
- the portable `.skills/doc-to-markdown/` wrapper for repos that want an agent-friendly entrypoint backed by the same package

## Install

Install from npm when the package is published:

```bash
npm install @doc2md/core
```

This is the preferred option for most users because it keeps the CLI local to the project and avoids global version drift.

If you want the `doc2md` command available directly in your shell everywhere, install it globally:

```bash
npm install -g @doc2md/core
```

Prefer global install only if you specifically want a machine-wide CLI.

If you are validating the package before publication, use the packed artifact:

```bash
npm run build --workspace=@doc2md/core
cd packages/core
npm pack
```

Then, from your consumer project:

```bash
npm install /absolute/path/to/doc2md-core-0.1.0.tgz
```

Node 22+ is required.

For release and publish guidance, see [Publishing `@doc2md/core`](./publishing-doc2md-core.md).

## API

### Batch conversion

```ts
import { convertDocuments } from "@doc2md/core";

const result = await convertDocuments(
  [
    "/absolute/path/resume.pdf",
    "/absolute/path/notes.docx",
    "/absolute/path/sheet.xlsx"
  ],
  {
    outputDir: "/absolute/path/out",
    maxDocuments: 25,
    concurrency: 4
  }
);

console.log(result.summary);
console.log(result.results);
```

### Single-document conversion

```ts
import { convertDocument } from "@doc2md/core";

const result = await convertDocument("/absolute/path/resume.pdf", {
  outputDir: "/absolute/path/out"
});

console.log(result);
```

### TypeScript consumers

The published package ships declarations for the public API. A minimal compile check looks like this:

```ts
import { convertDocuments } from "@doc2md/core";

async function main() {
  const result = await convertDocuments(
    ["/absolute/path/resume.pdf"],
    { outputDir: "/absolute/path/out" }
  );

  console.log(result.summary.total);
}

void main();
```

## CLI

If `@doc2md/core` is installed in your project, run the CLI with `npx` or `npm exec`:

```bash
npx doc2md /absolute/path/resume.pdf -o /absolute/path/out --max 10 --concurrency 4
```

Equivalent `npm exec` form:

```bash
npm exec doc2md -- /absolute/path/resume.pdf -o /absolute/path/out --max 10 --concurrency 4
```

If you installed the package globally, this also works:

```bash
doc2md /absolute/path/resume.pdf -o /absolute/path/out --max 10 --concurrency 4
```

Prefer `npx doc2md ...` for repo-specific use; prefer plain `doc2md ...` only after a global install when you want the command available everywhere.

You can also convert multiple documents in one call:

```bash
npx doc2md /absolute/path/a.pdf /absolute/path/b.docx -o /absolute/path/out
```

The CLI writes JSON to stdout and markdown files to the output directory.

## What The Package Returns

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
- Supported but unreadable or missing inputs return `status: "error"` for that document
- Exceeding `maxDocuments` throws `BatchLimitExceededError`
- Duplicate basenames are written with numeric suffixes like `resume.md`, `resume-1.md`, `resume-2.md`

## Supported Formats

- `.md`
- `.txt`
- `.json`
- `.csv`
- `.tsv`
- `.html`
- `.docx`
- `.xlsx`
- `.pdf`
- `.pptx`

## Portable Skill

This repo also ships a portable skill wrapper at `.skills/doc-to-markdown/`.

Suggested external-repo flow:

1. Install `@doc2md/core`
2. Copy `.skills/doc-to-markdown/` into your repo
3. Run the helper script or register the skill with your agent runtime

Example helper-script invocation:

```bash
node .skills/doc-to-markdown/scripts/convert-documents.mjs \
  --output-dir ./markdown-output \
  ./docs/resume.pdf \
  ./docs/notes.docx
```

That wrapper still returns JSON metadata and writes markdown files to disk. It stays thin on purpose.

## Good Fits

`@doc2md/core` is a good fit when you want:

- resume screening or ingestion pipelines
- MCP or server-side pre-processing before handing content to an LLM or agent
- batch document-to-markdown conversion in a Node tool
- a reusable extraction layer that stays aligned with the browser app's converters
- a portable skill that can be copied into another repo without reimplementing conversion logic

## Important Boundaries

- This package is Node-focused, not browser-focused
- It reuses the shared converters from `src/converters/`
- The browser app remains the easiest path for one-off interactive conversion and review
- The package defaults to file-based output; inline markdown in result objects is out of scope for this quest
