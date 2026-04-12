import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageDir = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(packageDir, "../..");

function runGit(args) {
  return execFileSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "pipe"
  }).trim();
}

export function bumpPatch(version) {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);

  if (!match) {
    throw new Error(`Invalid release version: ${version}`);
  }

  const [, major, minor, patch] = match;

  return `${major}.${minor}.${Number.parseInt(patch, 10) + 1}`;
}

export function deriveReleaseVersionFromRefs(latestTag, tagCommit, headCommit) {
  const normalizedTag = latestTag.replace(/^v/, "");

  if (!/^\d+\.\d+\.\d+$/.test(normalizedTag)) {
    throw new Error(`Unsupported release tag format: ${latestTag}`);
  }

  if (tagCommit.length > 0 && tagCommit === headCommit) {
    return normalizedTag;
  }

  return bumpPatch(normalizedTag);
}

export function deriveDisplayVersionFromState(
  latestTag,
  tagCommit,
  headCommit,
  isWorktreeDirty,
) {
  const releaseVersion = deriveReleaseVersionFromRefs(
    latestTag,
    tagCommit,
    headCommit,
  );

  return isWorktreeDirty ? bumpPatch(releaseVersion) : releaseVersion;
}

export function assertReleaseTagsAvailable(latestTag, env = process.env) {
  if (latestTag !== "0.0.0") {
    return;
  }

  if (env.REQUIRE_RELEASE_TAG === "true") {
    throw new Error(
      "REQUIRE_RELEASE_TAG is set but no numeric release tags were found. Ensure the checkout fetched tag history."
    );
  }
}

export function getReleaseVersionInfo() {
  let latestTag = "0.0.0";

  try {
    latestTag = runGit(["describe", "--tags", "--abbrev=0", "--match", "[0-9]*"]);
  } catch {
    latestTag = "0.0.0";
  }

  assertReleaseTagsAvailable(latestTag);

  let tagCommit = "";

  try {
    tagCommit = runGit(["rev-list", "-n", "1", latestTag]);
  } catch {
    tagCommit = "";
  }

  const headCommit = runGit(["rev-parse", "HEAD"]);
  const version = deriveReleaseVersionFromRefs(latestTag, tagCommit, headCommit);

  return {
    version,
    latestTag: latestTag.replace(/^v/, ""),
    tagCommit,
    headCommit,
    isTaggedCommit: tagCommit.length > 0 && tagCommit === headCommit
  };
}

export function isWorktreeDirty() {
  try {
    return runGit(["status", "--porcelain"]).length > 0;
  } catch {
    return false;
  }
}

export function getDisplayVersionInfo() {
  const release = getReleaseVersionInfo();
  const dirty = isWorktreeDirty();

  return {
    ...release,
    version: deriveDisplayVersionFromState(
      release.latestTag,
      release.tagCommit,
      release.headCommit,
      dirty,
    ),
    isWorktreeDirty: dirty,
  };
}
