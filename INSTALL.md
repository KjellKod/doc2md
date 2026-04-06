# Install doc2md

This guide is for people who want `doc2md` outside the browser UI.

If you only need one quick conversion, use the live site first:

- Open `https://kjellkod.github.io/doc2md/`
- Click the `Install & Use` tab
- Download the latest `doc2md-core-<version>.tgz` package

If you want the CLI for repeated work, automation, or agent workflows, follow the steps below.

## What You Need First

1. Install Node.js 22 or newer from `https://nodejs.org/`
2. Open a terminal
3. Confirm both tools are available:

```bash
node --version
npm --version
```

If those commands work, you are ready.

## Get The Tarball

You have two supported ways to get `@doc2md/core`.

### Option A: Download it from the site

1. Open `https://kjellkod.github.io/doc2md/`
2. Click `Install & Use`
3. Download the latest `doc2md-core-<version>.tgz`

### Option B: Build it locally from this repo

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

## Install It Globally

Use a global install when you want `doc2md` available from any folder.

```bash
npm install -g /absolute/path/to/doc2md-core-<derived-version>.tgz
```

After that, verify the command is available:

```bash
doc2md --help
```

### What happens after a global install?

`npm` unpacks the tarball into its global package location and adds the `doc2md` command to your global npm bin path.

That means:

- you do not need to stay inside this repo
- you do not need to keep the tarball next to your documents
- you can run `doc2md ...` from anywhere once the install finishes

### Can I delete the tarball after global install?

Yes.

The tarball is only the installer input. Once `npm install -g ...` succeeds, the installed package lives in npm's global directory. Deleting the `.tgz` file does not uninstall `doc2md`.

## Install It In One Project Only

Use a project-local install when you want the CLI only inside one repo or test folder.

From your project directory:

```bash
npm install /absolute/path/to/doc2md-core-<derived-version>.tgz
```

Then run it with `npx`:

```bash
npx doc2md /absolute/path/to/resume.pdf -o ./out
```

This keeps the dependency local to that project instead of your whole machine.

## Verify It Works

Global install:

```bash
doc2md --help
doc2md /absolute/path/to/resume.pdf -o ./out
```

Project-local install:

```bash
npx doc2md --help
npx doc2md /absolute/path/to/resume.pdf -o ./out
```

Successful runs write Markdown files into the output directory you pass with `-o`.

## Portable Skill Wrapper

Use the portable skill when you want an agent-friendly repo wrapper around the
same `@doc2md/core` package contract.

### Repo-local setup

1. Install `@doc2md/core` in the target repo from the tarball
2. Copy `.skills/doc-to-markdown/` into that repo
3. Point your agent or repo instructions at `.skills/doc-to-markdown/SKILL.md`

Project-local install:

```bash
npm install /absolute/path/to/doc2md-core-<derived-version>.tgz
```

Direct helper invocation:

```bash
node .skills/doc-to-markdown/scripts/convert-documents.mjs \
  --output-dir ./markdown-output \
  ./docs/resume.pdf
```

### Claude app custom skill

If your Claude host supports uploaded custom skills, package the
`.skills/doc-to-markdown/` folder as a `.skill` file. In practice, that means a
ZIP-format bundle using Anthropic's `.skill` extension rather than a plain
`.zip` filename. Keep the package contract the same: the helper still expects
`@doc2md/core` to be available where the command runs.

### Claude CLI and Codex

For repo-local agent flows, keep the skill in the repo and reference
`.skills/doc-to-markdown/SKILL.md` from your repo instructions or prompt. The
helper script above remains the exact fallback when you want deterministic JSON
output and written markdown files.

## Upgrade To A Newer Version

1. Download or build a newer `doc2md-core-<version>.tgz`
2. Run the same install command again

Global upgrade:

```bash
npm install -g /absolute/path/to/newer-doc2md-core-<derived-version>.tgz
```

Project-local upgrade:

```bash
npm install /absolute/path/to/newer-doc2md-core-<derived-version>.tgz
```

`npm` replaces the older installed version with the newer one.

## Troubleshooting

### `doc2md: command not found`

- If you installed globally, close and reopen the terminal once
- Run `npm config get prefix` and make sure that prefix's bin directory is on your `PATH`
- If you installed locally, use `npx doc2md ...` instead of `doc2md ...`

### `npm` says the tarball path does not exist

- Use an absolute path to the `.tgz` file
- Confirm the filename ends in `.tgz`
- If you built locally, check `packages/core/`

### You want the easiest beginner path

Start from the browser UI at `https://kjellkod.github.io/doc2md/`, then use the `Install & Use` tab for the download link and the same commands shown here.

## Related Docs

- [README.md](README.md)
- [Using `@doc2md/core`](docs/using-doc2md-core.md)
- [Portable skill wrapper](#portable-skill-wrapper)
