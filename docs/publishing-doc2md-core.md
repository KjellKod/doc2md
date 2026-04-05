# Publishing `@doc2md/core`

This note explains what it means to publish `@doc2md/core`, what the implications are, and how to test the package locally before doing a real npm release.

## What "publish" means

Publishing a package means uploading a specific package version to a package registry so other people can install it by name.

For npm, that usually means:

```bash
npm install @doc2md/core
```

instead of installing from this repo, a tarball path, or a workspace.

For `@doc2md/core`, a real publish means:

- the package name becomes public and installable from the npm registry
- the published version becomes part of the public package history
- consumers can use the documented package API and CLI without repo-specific setup

## Important implications

Publishing is not just "sharing a build artifact." It creates a public contract.

Once a version is published:

- that exact version should be treated as immutable
- consumers may depend on the documented API, CLI, and output behavior
- changes to the package become release-management work, not just repo work

Practical implication:

- if `0.6.1` is the latest release tag and `HEAD` is on that tagged commit, the local package artifact uses `0.6.1`
- if `HEAD` is ahead of the latest release tag, the local package artifact bumps the patch version, for example `0.6.1` -> `0.6.2`
- emitted package versions always use `X.Y.Z`, not `vX.Y.Z`

## What you need before a real npm publish

1. Control of the npm scope
   `@doc2md/core` requires publish rights to the `@doc2md` scope.

2. npm authentication
   For a manual publish, use `npm login`.

3. Public access on first publish
   Scoped packages default to restricted access, so the first public publish should use:

```bash
cd packages/core
npm publish --access public --workspaces=false
```

4. A clean publish-ready package
   Run:

```bash
npm run test --workspace=@doc2md/core
npm run build --workspace=@doc2md/core
cd packages/core
npm publish --dry-run --workspaces=false
```

## Tradeoffs

### Publish to npm

Pros:

- zero-friction install for external users
- normal package/CLI experience
- best fit for reuse across repos and tools

Cons:

- versioning and compatibility become public commitments
- release mistakes are harder to undo
- requires scope ownership and release discipline

### Use `npm run pack:local`

Pros:

- best local test of the real package artifact
- stamps the tarball with the release-derived version rule automatically
- no registry ownership required
- easy to install in another repo from a `.tgz`

Cons:

- not discoverable
- install path is less convenient than npm
- still a manual handoff

### Use `npm link`

Pros:

- fast for local development
- easy when iterating across two repos on one machine

Cons:

- not a true package-artifact test
- symlink behavior can hide packaging mistakes
- weaker signal than `npm run pack:local`

### Use a local/private registry

Pros:

- closest thing to a real publish without going public
- good for rehearsal or internal distribution

Cons:

- more setup
- extra registry config for consumers
- usually overkill unless you publish packages regularly

## How to "publish locally"

There are really three different things people mean by that.

### 1. Local package-artifact test

This is the recommended option for this repo.

From this repo:

```bash
npm run pack:local --workspace=@doc2md/core
```

That creates a tarball such as `packages/core/doc2md-core-<derived-version>.tgz`.

Then from another project:

```bash
npm install /absolute/path/to/doc2md-core-<derived-version>.tgz
```

This does not publish to npm. It just installs the exact tarball that npm would publish.

### 2. Local development link

```bash
cd packages/core
npm link
```

Then in a consumer repo:

```bash
npm link @doc2md/core
```

This is useful for iteration, but it is weaker than `npm run pack:local` for release validation.

### 3. Local registry publish

If you want a real publish flow without using the public npm registry, run a local registry such as Verdaccio and publish to that registry instead.

That is closer to a production publish, but it adds setup and is usually only worth it if you want to rehearse a true release pipeline.

## Recommended release path for `@doc2md/core`

1. Validate with `npm run pack:local`
2. Test install in a clean consumer project
3. Do the first real publish manually
4. Move later publishes to trusted publishing in CI

## Good default rule

If the goal is "does the package really install and work," use `npm run pack:local`.

If the goal is "make this available to other people with zero pain," do a real npm publish.

## Official references

- npm scoped public packages: `https://docs.npmjs.com/creating-and-publishing-scoped-public-packages/`
- npm config `access`: `https://docs.npmjs.com/cli/v8/using-npm/config/`
- npm trusted publishing: `https://docs.npmjs.com/trusted-publishers/`
