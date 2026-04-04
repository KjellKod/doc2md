# `@doc2md/core`

Node/package entrypoint for doc2md's shared document-to-markdown converters.

Use this package when you want:

- batch conversion in Node
- a function call instead of the browser UI
- CLI access for scripts and pipelines
- document pre-processing before handing content to an MCP tool or LLM agent

## API

```ts
import { convertDocument, convertDocuments } from "@doc2md/core";
```

### `convertDocument(inputPath, options)`

Convert one document, write markdown to `options.outputDir`, and return metadata about the result.

### `convertDocuments(inputPaths, options)`

Convert `1..N` documents, write markdown files to `options.outputDir`, and return batch metadata.

## Options

```ts
{
  outputDir: string;
  maxDocuments?: number;
  concurrency?: number;
}
```

## Output Contract

- Markdown is written to disk
- Result JSON contains metadata, not inline markdown
- Unsupported files are skipped
- Supported but unreadable inputs return `status: "error"`
- Duplicate basenames get numeric suffixes like `resume.md` and `resume-1.md`

## CLI

```bash
doc2md /absolute/path/a.pdf /absolute/path/b.docx -o /absolute/path/out
```

Optional flags:

- `--max <n>`
- `--concurrency <n>`

## In This Repository

Right now this package is shipped as a workspace package from this repo.

For the full usage guide, install flow, and examples, see [`docs/using-doc2md-core.md`](../../docs/using-doc2md-core.md).
