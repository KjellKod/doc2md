# Install the `doc-to-markdown` skill

Last verified: 2026-04-04

This skill is a portable wrapper around `@doc2md/core`. It does not convert documents by itself. It delegates to the package and keeps the repo-local skill thin.

## Prerequisites

1. Node.js 22 or newer
2. `@doc2md/core` installed in the target repo
3. This directory copied into the target repo as `.skills/doc-to-markdown/`

## What To Copy

Copy this directory into the target repo:

```text
.skills/doc-to-markdown/
```

Keep these files together:

- `SKILL.md`
- `INSTALL.md`
- `examples/basic-usage.md`
- `scripts/convert-documents.mjs`

## Install `@doc2md/core`

Current reality:

- public npm publication is not the supported path today
- use the packed tarball from this repo or the GitHub Pages download instead

Get the tarball with one of these supported flows:

1. Download it from `https://kjellkod.github.io/doc2md/`
2. Open the `Install & Use` tab
3. Download `doc2md-core-<version>.tgz`

Or build it from this repo:

```bash
git clone https://github.com/KjellKod/doc2md.git
cd doc2md
npm install
npm run pack:local --workspace=@doc2md/core
```

That creates a file like:

```text
packages/core/doc2md-core-<derived-version>.tgz
```

Project-local install:

```bash
npm install /absolute/path/to/doc2md-core-<derived-version>.tgz
```

Sanity check:

```bash
npx doc2md --help
```

## Claude CLI

What Claude CLI supports today:

- Claude CLI can work with repo-local instructions and repo-local files
- This portable package is a skill folder plus a helper script, not an MCP server
- `claude mcp add ...` is therefore not the install path for this skill by itself
- This repo does not rely on a documented `.claude/settings.json` `skills` path setting for the package today

Concrete setup:

1. Copy `.skills/doc-to-markdown/` into the target repo
2. Install `@doc2md/core` in that same repo with `npm install /absolute/path/to/doc2md-core-<derived-version>.tgz`
3. Add a short repo instruction in `.claude/CLAUDE.md`, for example:

```md
When asked to convert local documents to Markdown, follow `.skills/doc-to-markdown/SKILL.md`.
Use `.skills/doc-to-markdown/scripts/convert-documents.mjs` for deterministic runs.
```

4. Inside Claude CLI, invoke it by referencing the skill path explicitly

Example Claude prompt inside the CLI session:

```text
Use `.skills/doc-to-markdown/SKILL.md`.
Convert `./docs/resume.pdf` to Markdown in `./markdown-output`.
If the output directory already exists, ask before reusing it.
```

Deterministic fallback command:

```bash
node .skills/doc-to-markdown/scripts/convert-documents.mjs \
  --output-dir ./markdown-output \
  ./docs/resume.pdf
```

Notes:

- Repo-local skills are the stable packaging unit here
- If you need `claude mcp add`, that is a separate wrapper project: you would first need to expose this helper through a real MCP server
- If repo-local instruction loading is unclear in your Claude CLI version, point the session directly at `.skills/doc-to-markdown/SKILL.md`

## Claude Desktop / Cowork-Style Flows

What these hosts support today:

- There is no universal documented "install this skill globally for every desktop session" flow in this repo
- The supported portable path is still the repo copy under `.skills/doc-to-markdown/`
- The nearest reliable wrapper flow is: copy the skill into the project, then reference it from project instructions

Concrete setup:

1. Copy `.skills/doc-to-markdown/` into the project
2. Install `@doc2md/core` in that project
3. Add a project note in `CLAUDE.md` or the host's project instructions, for example:

```md
Use `.skills/doc-to-markdown/SKILL.md` for local document conversion.
Write markdown files to a user-approved output directory and report each output path.
```

4. In the desktop/cowork chat, invoke it with the repo path and output directory

Example prompt:

```text
Use the repo-local `.skills/doc-to-markdown/SKILL.md` skill.
Convert `./docs/resume.pdf` and `./docs/notes.docx` into `./markdown-output`.
Report every written file and any warnings.
```

Exact helper command if you want zero ambiguity:

```bash
node .skills/doc-to-markdown/scripts/convert-documents.mjs \
  --output-dir ./markdown-output \
  ./docs/resume.pdf \
  ./docs/notes.docx
```

## Codex / OpenAI CLI Flows

What Codex/OpenAI CLI supports today:

- There is no first-class global "skill install" registry for this package
- The nearest supported flow is to keep the skill in the repo and point Codex at it through `AGENTS.md`, developer instructions, or the prompt
- The direct script remains the exact fallback when you want deterministic behavior

Concrete setup:

1. Copy `.skills/doc-to-markdown/` into the repo
2. Install `@doc2md/core` locally in that repo
3. Add an instruction in `AGENTS.md` or your Codex developer prompt, for example:

```md
For document-to-markdown work, use `.skills/doc-to-markdown/SKILL.md` instead of inventing a new converter flow.
```

4. Invoke it by prompt or run the helper directly

Example prompt:

```text
Follow `.skills/doc-to-markdown/SKILL.md`.
Convert `./docs/resume.pdf` and `./docs/notes.docx` into `./markdown-output`.
Do not silently reuse a risky output directory, and report each output path.
```

Example helper invocation:

```bash
node .skills/doc-to-markdown/scripts/convert-documents.mjs \
  --output-dir ./markdown-output \
  ./docs/resume.pdf \
  ./docs/notes.docx
```

Notes:

- Codex can read repo files directly, so shipping the skill with the repo is the important part
- The helper script is the contract-preserving fallback when you want machine-readable JSON output

## Invocation Pattern

Minimal example:

```bash
node .skills/doc-to-markdown/scripts/convert-documents.mjs \
  --output-dir ./markdown-output \
  ./docs/resume.pdf
```

Optional flags:

- `--max <n>`
- `--concurrency <n>`

## Result Shape

The helper script prints the package JSON result to stdout.

Per document, expect:

- `inputPath`
- `outputPath`
- `status`
- `warnings`
- optional `quality`
- optional `error`
- `durationMs`

See [SKILL.md](./SKILL.md) for the agent behavior contract and confidence mapping.
