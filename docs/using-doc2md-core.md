# Using `@doc2md/core`

`doc2md` now has three practical paths:

- the live browser app at `https://kjellkod.github.io/doc2md/` for private, local-first conversion in the browser
- the `@doc2md/core` package for Node, batch jobs, MCP tools, and automation
- the portable `.skills/doc-to-markdown/` wrapper for repos that want an agent-friendly entrypoint backed by the same package

## Start Here

If you are new to Node, npm, or tarball installs, use the beginner-first [INSTALL.md](../INSTALL.md) guide first.

That guide covers:

- prerequisites
- downloading the latest released Pages tarball from the `Install & Use` tab
- global tarball install
- project-local tarball install
- deleting the tarball after install
- upgrades
- troubleshooting

This document focuses on the package contract, copy-paste usage examples, and the portable skill.

## Current Install Reality

`@doc2md/core` is not currently distributed through the public npm registry as a supported user path.

That means:

- `npm install @doc2md/core` is not the path to use today
- `npm install -g @doc2md/core` is also not the path to use today
- use the released `.tgz` artifact from GitHub Pages or one built locally with `npm run pack:local --workspace=@doc2md/core`

If you are validating the package from this repo:

```bash
npm run pack:local --workspace=@doc2md/core
```

That creates a tarball such as `packages/core/doc2md-core-<derived-version>.tgz`.

## Copy-Paste Examples

Single file with a project-local install:

```bash
npx doc2md /absolute/path/resume.pdf -o ./out
```

Single remote URL:

```bash
npx doc2md https://example.com/docs/guide.md -o ./out
```

Multiple files in one run:

```bash
npx doc2md /absolute/path/a.pdf /absolute/path/b.docx https://example.com/docs/guide.md -o ./out
```

Global tarball install flow:

```bash
doc2md /absolute/path/resume.pdf -o ./out
```

Skill-driven helper-script flow:

```bash
node .skills/doc-to-markdown/scripts/convert-documents.mjs \
  --output-dir ./out \
  ./docs/resume.pdf
```

For release and publish guidance, see [Publishing `@doc2md/core`](./publishing-doc2md-core.md).

## API

### Batch conversion

```ts
import { convertDocuments } from "@doc2md/core";

const result = await convertDocuments(
  [
    "/absolute/path/resume.pdf",
    "/absolute/path/notes.docx",
    "/absolute/path/sheet.xlsx",
    "https://example.com/docs/guide.md"
  ],
  {
    outputDir: "/absolute/path/out",
    maxDocuments: 25,
    concurrency: 4,
    remoteTimeoutMs: 30000
  }
);

console.log(result.summary);
console.log(result.results);
```

### Single-document conversion

```ts
import { convertDocument } from "@doc2md/core";

const result = await convertDocument(
  "https://example.com/docs/guide.md",
  {
    outputDir: "/absolute/path/out"
  }
);

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

If `@doc2md/core` is installed in your project from a local tarball, run the CLI with `npx` or `npm exec`:

```bash
npx doc2md /absolute/path/resume.pdf https://example.com/docs/guide.md -o /absolute/path/out --max 10 --concurrency 4 --remote-timeout-ms 30000
```

Equivalent `npm exec` form:

```bash
npm exec doc2md -- /absolute/path/resume.pdf https://example.com/docs/guide.md -o /absolute/path/out --max 10 --concurrency 4 --remote-timeout-ms 30000
```

If you installed the package globally, including from a local tarball, this also works:

```bash
doc2md /absolute/path/resume.pdf https://example.com/docs/guide.md -o /absolute/path/out --max 10 --concurrency 4 --remote-timeout-ms 30000
```

Prefer `npx doc2md ...` for repo-specific use. Use plain `doc2md ...` after a global install, including `npm install -g /absolute/path/to/doc2md-core-<derived-version>.tgz`.

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
- Remote URL download failures, blocked access, auth-gated responses, and timeout failures return `status: "error"` for that document
- Exceeding `maxDocuments` throws `BatchLimitExceededError`
- Duplicate basenames are written with numeric suffixes like `resume.md`, `resume-1.md`, `resume-2.md`

## Remote URL Contract

`@doc2md/core` accepts remote document URLs anywhere a local path is accepted.

Direct-fetch rules:

- Remote documents are fetched directly by the machine running Node. There is no doc2md proxy, queue, or backend service.
- The remote host sees the caller's IP and request metadata.
- Auth-gated or sign-in-only URLs can fail if the current process cannot fetch them directly.
- Remote downloads time out after 30 seconds by default. Use `remoteTimeoutMs` in the API or `--remote-timeout-ms` in the CLI to override that.
- Browser-only size guards do not apply here. The package does not impose a byte-size limit on remote URLs.

Remote URL handling:

- doc2md fetches remote URLs exactly as provided.
- doc2md does not normalize provider-specific view URLs into download URLs.
- If a site exposes both a page URL and a direct-download/raw URL, provide the direct-download/raw URL.

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

1. Install `@doc2md/core` from the tarball in the target repo
2. Copy `.skills/doc-to-markdown/` into your repo
3. Review the portable skill section in [INSTALL.md](../INSTALL.md#portable-skill-wrapper) for host-specific setup notes
4. Run the helper script or register the skill with your agent runtime

Example helper-script invocation:

```bash
node .skills/doc-to-markdown/scripts/convert-documents.mjs \
  --output-dir ./markdown-output \
  ./docs/resume.pdf \
  ./docs/notes.docx
```

That wrapper still returns JSON metadata and writes markdown files to disk. It stays thin on purpose.

### Skill Behavior Contract

The skill now documents these agent rules:

- ask before writing when the output location is ambiguous
- never silently overwrite existing files
- always report the written output paths
- report confidence from the real package contract instead of inventing a new field

Confidence is derived from `status` and `quality`:

- `success` plus `quality.level: "good"` with no substantive warnings = high confidence
- `warning`, or `success` with `quality.level: "review"` or `"poor"` = medium confidence
- `error` or `skipped` = failure

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
