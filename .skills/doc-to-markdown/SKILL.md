---
name: doc-to-markdown
description: Portable wrapper skill for converting one or more local documents to Markdown via @doc2md/core. Use when a repo wants an agent-friendly document-to-markdown entrypoint without reimplementing converter logic.
---

# doc-to-markdown

Use this skill when you want to convert local files to Markdown from an agent workflow, script, or repo utility while keeping the real conversion logic inside `@doc2md/core`.

## Install

1. Install `@doc2md/core`
2. Copy this `.skills/doc-to-markdown/` directory into the target repo
3. Run the helper script or wire the skill into your agent runtime

If you are validating before npm publication, install the packed tarball instead of the registry package.

## What It Does

- accepts one or more file paths
- delegates to `@doc2md/core`
- writes Markdown files to disk
- prints JSON metadata to stdout
- skips unsupported files without failing the whole batch

## Helper Script

```bash
node .skills/doc-to-markdown/scripts/convert-documents.mjs \
  --output-dir ./markdown-output \
  ./docs/resume.pdf \
  ./docs/notes.docx
```

Optional flags:

- `--max <n>`
- `--concurrency <n>`

## Output Contract

- markdown content is written to files, not embedded inline in the JSON result
- JSON output includes per-document status, warnings, duration, optional quality, optional error, and `outputPath`
- `BatchLimitExceededError` exits non-zero with a JSON error payload on stderr

## Rules

- do not add converter logic here
- do not parse documents here
- do not hardcode repo-specific paths
- keep this as a thin wrapper over the package contract
