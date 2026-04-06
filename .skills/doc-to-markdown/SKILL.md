---
name: doc-to-markdown
description: Portable wrapper skill for converting one or more local documents to Markdown via @doc2md/core. Use when a repo wants an agent-friendly document-to-markdown entrypoint without reimplementing converter logic.
---

# doc-to-markdown

Use this skill when you want to convert local files to Markdown from an agent workflow, script, or repo utility while keeping the real conversion logic inside `@doc2md/core`.

## Portable Package Contents

Ship this directory as a self-contained repo asset:

- `SKILL.md`
- `examples/basic-usage.md`
- `scripts/convert-documents.mjs`

## What It Does

- accepts one or more local input file paths
- delegates to `@doc2md/core`
- writes Markdown files to disk
- prints JSON metadata to stdout
- skips unsupported files without failing the whole batch

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

## Helper Script

Single file:

```bash
node .skills/doc-to-markdown/scripts/convert-documents.mjs \
  --output-dir ./markdown-output \
  ./docs/resume.pdf
```

Multiple files:

```bash
node .skills/doc-to-markdown/scripts/convert-documents.mjs \
  --output-dir ./markdown-output \
  ./docs/resume.pdf \
  ./docs/notes.docx
```

Optional flags:

- `--max <n>`
- `--concurrency <n>`

## Host Setup

### Claude app (uploaded skill)

1. Zip the `.skills/doc-to-markdown/` folder.
2. In Claude, open `Customize` -> `Skills` and upload that zip.
3. Use this skill inside a repository that already has `@doc2md/core` installed so the helper script can resolve the package at runtime.

### Claude CLI / repo-local

1. Copy this folder into the target repo at `.skills/doc-to-markdown/`.
2. Install `@doc2md/core` in that repo.
3. Run the helper from the repo root, for example:

```bash
node .skills/doc-to-markdown/scripts/convert-documents.mjs \
  --output-dir ./markdown-output \
  ./docs/resume.pdf
```

### Codex

1. Use the same repo-local layout: `.skills/doc-to-markdown/` inside the working repo.
2. Install `@doc2md/core` in that repo before invoking the helper.
3. Keep input and output paths inside the writable workspace so the sandbox can read sources and write Markdown results.

## Agent Behavior Contract

When using this skill in an agent workflow:

1. Ask the user where Markdown should be written if the output location is ambiguous.
2. Do not silently reuse a risky output location.
3. Do not silently overwrite existing files.
4. Always report what was written and what needs review.

Practical rule for output paths:

- If the user gave an explicit output directory, use it.
- If the user did not give one, ask before writing.
- If the proposed directory already contains related outputs and the user has not confirmed reuse, ask before writing.

Overwrite rule:

- `@doc2md/core` writes with collision-safe numeric suffixes instead of replacing an existing file.
- Even with that safety, the agent should still confirm the output directory when reuse could be confusing or risky.

## Result Reporting

Always report, per document:

- input file path
- output markdown path, or `null` if no file was written
- status
- warnings
- quality summary when present
- confidence summary derived from `status` and `quality`

Recommended human-readable summary format:

```text
Input: /absolute/path/resume.pdf
Output: /absolute/path/out/resume.md
Status: success
Confidence: high
Warnings: none
Quality: Good: Selectable text detected. Layout looks straightforward.
```

If multiple files are processed, summarize each file and then add the batch totals.

## Confidence Derivation

The helper script does not emit a separate `confidence` field. Derive confidence from the existing `status` and `quality` fields returned by `@doc2md/core`.

Use this mapping:

- `status: "success"` with `quality.level: "good"` and no substantive warnings = high confidence
- `status: "warning"`, or `status: "success"` with `quality.level: "review"` or `quality.level: "poor"` = medium confidence
- `status: "error"` or `status: "skipped"` = failure

If `quality` is absent but the status is still `success`, report that the conversion succeeded and mention that no quality signal was returned for that file.

## Output Contract

- markdown content is written to files, not embedded inline in the JSON result
- JSON output includes per-document `inputPath`, `outputPath`, `status`, `warnings`, `durationMs`, optional `quality`, and optional `error`
- batch output includes summary totals for succeeded, warned, skipped, failed, and total duration
- `BatchLimitExceededError` exits non-zero with a JSON error payload on stderr

## Rules

- do not add converter logic here
- do not parse documents here
- do not hardcode repo-specific paths
- do not invent new result fields that the package does not return
- keep this as a thin wrapper over the package contract

## References

- [examples/basic-usage.md](./examples/basic-usage.md)
