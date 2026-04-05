# `@doc2md/core`

Publish-ready Node API and CLI for doc2md's document-to-Markdown converters.

Use this package when you want:

- batch conversion in Node
- a function call instead of the browser UI
- CLI access for scripts and pipelines
- document pre-processing before handing content to an MCP tool or LLM agent
- a portable skill wrapper that reuses the same package contract

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

If you are validating a local build before publication, install the packed artifact:

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

## API

```ts
import { convertDocuments } from "@doc2md/core";

const result = await convertDocuments(
  ["/absolute/path/resume.pdf"],
  {
    outputDir: "/absolute/path/out",
    maxDocuments: 10,
    concurrency: 4
  }
);

console.log(result.summary);
console.log(result.results[0].outputPath);
```

Single-document conversion:

```ts
import { convertDocument } from "@doc2md/core";

const result = await convertDocument("/absolute/path/resume.pdf", {
  outputDir: "/absolute/path/out"
});

console.log(result.status);
console.log(result.outputPath);
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

For mixed batches, you can pass multiple files in one call:

```bash
npx doc2md /absolute/path/a.pdf /absolute/path/b.docx -o /absolute/path/out
```

## Output Contract

- Markdown is written to disk, not embedded inline in the result JSON.
- Result rows include `inputPath`, `outputPath`, `status`, `warnings`, `durationMs`, and optional `quality` or `error`.
- Unsupported files are skipped without failing the batch.
- Supported but unreadable inputs return `status: "error"` for that document.
- Exceeding `maxDocuments` throws `BatchLimitExceededError`.
- Duplicate basenames use numeric suffixes such as `resume.md`, `resume-1.md`, and `resume-2.md`.

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

## Skill Wrapper

If you want a copyable agent-friendly wrapper, use the repo's `.skills/doc-to-markdown/` skill. It delegates to `@doc2md/core`; it does not implement a second converter system.

For the extended usage guide, CLI notes, and portable skill instructions, see [`docs/using-doc2md-core.md`](../../docs/using-doc2md-core.md).
