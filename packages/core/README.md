# `@doc2md/core`

Publish-ready Node API and CLI for doc2md's document-to-Markdown converters.

Use this package when you want:

- batch conversion in Node
- a function call instead of the browser UI
- CLI access for scripts and pipelines
- document pre-processing before handing content to an MCP tool or LLM agent
- a portable skill wrapper that reuses the same package contract

## Install

If you do not already have Node.js and `npm` installed:

- Windows and macOS: install Node.js from `https://nodejs.org/en/download/`
- Installing Node.js also installs `npm`
- Node 22+ is required for `@doc2md/core`

`@doc2md/core` is not planned for public npm publication at this time.

If a public npm release ever happens in the future, the install would look like this:

```bash
npm install @doc2md/core
```

For now, use a local tarball or local folder install instead.

If a public npm release ever happens in the future, and you want the `doc2md` command available directly in your shell everywhere, the global install would look like this:

```bash
npm install -g @doc2md/core
```

Until then, those npm registry commands will fail with `404`.

If you are validating a local build before publication, install the packed artifact:

```bash
npm run pack:local --workspace=@doc2md/core
```

That creates a local tarball such as `packages/core/doc2md-core-<derived-version>.tgz`.

If you want project-local install:

```bash
npm install /absolute/path/to/doc2md-core-<derived-version>.tgz
```

Then run the CLI with `npx`:

```bash
npx doc2md /absolute/path/resume.pdf -o /absolute/path/out
```

If you want the `doc2md` command available directly in your shell right now, install that local tarball globally:

```bash
npm install -g /absolute/path/to/doc2md-core-<derived-version>.tgz
```

If you are already in `packages/core`, this also works:

```bash
npm install -g ./doc2md-core-<derived-version>.tgz
```

## API

```ts
import { convertDocuments } from "@doc2md/core";

const result = await convertDocuments(
  [
    "/absolute/path/resume.pdf",
    "https://raw.githubusercontent.com/KjellKod/doc2md/refs/heads/main/README.md"
  ],
  {
    outputDir: "/absolute/path/out",
    maxDocuments: 10,
    concurrency: 4,
    remoteTimeoutMs: 30000
  }
);

console.log(result.summary);
console.log(result.results[0].outputPath);
```

Single-document conversion:

```ts
import { convertDocument } from "@doc2md/core";

const result = await convertDocument(
  "https://raw.githubusercontent.com/KjellKod/doc2md/refs/heads/main/README.md",
  {
    outputDir: "/absolute/path/out"
  }
);

console.log(result.status);
console.log(result.outputPath);
```

## CLI

If `@doc2md/core` is installed in your project, run the CLI with `npx` or `npm exec`:

```bash
npx doc2md /absolute/path/resume.pdf https://raw.githubusercontent.com/KjellKod/doc2md/refs/heads/main/README.md -o /absolute/path/out --max 10 --concurrency 4 --remote-timeout-ms 30000
```

Equivalent `npm exec` form:

```bash
npm exec doc2md -- /absolute/path/resume.pdf https://raw.githubusercontent.com/KjellKod/doc2md/refs/heads/main/README.md -o /absolute/path/out --max 10 --concurrency 4 --remote-timeout-ms 30000
```

If you installed the package globally, including from a local tarball, this also works:

```bash
doc2md /absolute/path/resume.pdf https://raw.githubusercontent.com/KjellKod/doc2md/refs/heads/main/README.md -o /absolute/path/out --max 10 --concurrency 4 --remote-timeout-ms 30000
```

Prefer `npx doc2md ...` for repo-specific use. Use plain `doc2md ...` after a global install, including `npm install -g /absolute/path/to/doc2md-core-<derived-version>.tgz`.

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
- Remote URLs are fetched directly from the machine running Node; there is no doc2md proxy or backend download service.
- Remote URL downloads time out after 30 seconds by default. Override that with `remoteTimeoutMs` in the API or `--remote-timeout-ms` in the CLI.
- Browser-only size limits do not apply here. `@doc2md/core` does not add a byte-size cap for remote URLs.

## Remote URL Inputs

`@doc2md/core` and the CLI accept local file paths and direct remote document URLs in the same input list.

Remote URLs are fetched exactly as provided. doc2md does not normalize provider-specific page URLs into download URLs, so if a host exposes a separate raw/download URL, pass that direct URL explicitly.

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
