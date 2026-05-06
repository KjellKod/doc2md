// @vitest-environment node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  githubBlobUrl,
  resolveReleaseRef,
} from "../../scripts/generate-notice-inventory.mjs";

const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..");
const SCRIPT_PATH = path.join(REPO_ROOT, "scripts", "generate-notice-inventory.mjs");
const BUILD_MAC_APP_PATH = path.join(REPO_ROOT, "scripts", "build-mac-app.sh");
const NOTICES_PATH = path.join(REPO_ROOT, "apps", "macos", "THIRD_PARTY_NOTICES.md");

function runGenerator(args, env = {}) {
  return spawnSync("node", [SCRIPT_PATH, ...args], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
}

describe("notice inventory release refs", () => {
  it("uses main when DOC2MD_RELEASE_REF is unset", () => {
    expect(resolveReleaseRef({ env: {} })).toBe("main");
    expect(githubBlobUrl("package-lock.json")).toBe(
      "https://github.com/KjellKod/doc2md/blob/main/package-lock.json",
    );
  });

  it("trims valid DOC2MD_RELEASE_REF values before building GitHub URLs", () => {
    const releaseRef = resolveReleaseRef({
      env: { DOC2MD_RELEASE_REF: "  v2.2.2  " },
    });

    expect(releaseRef).toBe("v2.2.2");
    expect(githubBlobUrl("package-lock.json", releaseRef)).toBe(
      "https://github.com/KjellKod/doc2md/blob/v2.2.2/package-lock.json",
    );
  });

  it("writes release-ref output to --output without touching committed notices", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "doc2md-notices-"));
    const outputPath = path.join(tempDir, "THIRD_PARTY_NOTICES.md");
    const before = fs.readFileSync(NOTICES_PATH, "utf8");

    const result = runGenerator(["--output", outputPath], {
      DOC2MD_RELEASE_REF: "v2.2.2",
    });

    const output = [result.stdout, result.stderr].filter(Boolean).join("\n");
    expect(result.status, `generator output:\n${output}`).toBe(0);

    const generated = fs.readFileSync(outputPath, "utf8");
    expect(generated).toContain("https://github.com/KjellKod/doc2md/blob/v2.2.2/");
    expect(generated).not.toContain("https://github.com/KjellKod/doc2md/blob/main/");
    expect(fs.readFileSync(NOTICES_PATH, "utf8")).toBe(before);
  });

  it("keeps --check pinned to main when DOC2MD_RELEASE_REF is set", () => {
    const before = fs.readFileSync(NOTICES_PATH, "utf8");

    const result = runGenerator(["--check"], {
      DOC2MD_RELEASE_REF: "v2.2.2",
    });

    const output = [result.stdout, result.stderr].filter(Boolean).join("\n");
    expect(result.status, `generator output:\n${output}`).toBe(0);
    expect(fs.readFileSync(NOTICES_PATH, "utf8")).toBe(before);
  });

  it.each([
    ["whitespace-only", "   "],
    ["embedded whitespace", "v2.2.2 beta"],
    ["control character", "v2.2.2\nbeta"],
    ["slash", "release/v2.2.2"],
    ["backslash", "release\\v2.2.2"],
    ["path traversal", "v2..2"],
    ["question mark", "v2.2.2?x"],
    ["hash", "v2.2.2#anchor"],
    ["percent", "v2%2E2%2E2"],
    ["colon", "refs:tags:v2.2.2"],
  ])("rejects malformed DOC2MD_RELEASE_REF values: %s", (_label, releaseRef) => {
    expect(() =>
      resolveReleaseRef({ env: { DOC2MD_RELEASE_REF: releaseRef } }),
    ).toThrow("Invalid DOC2MD_RELEASE_REF");
  });

  it("fails without echoing malformed DOC2MD_RELEASE_REF values", () => {
    const result = runGenerator(["--output", path.join(os.tmpdir(), "unused-notices.md")], {
      DOC2MD_RELEASE_REF: "release/v2.2.2",
    });

    const output = [result.stdout, result.stderr].filter(Boolean).join("\n");
    expect(result.status).not.toBe(0);
    expect(output).toContain("Invalid DOC2MD_RELEASE_REF");
    expect(output).not.toContain("release/v2.2.2");
  });

  it("routes empty DOC2MD_RELEASE_REF through Mac build notice validation", () => {
    const fakeDeveloperDir = fs.mkdtempSync(path.join(os.tmpdir(), "doc2md-xcode-"));
    const fakeXcodebuildDir = path.join(fakeDeveloperDir, "usr", "bin");
    fs.mkdirSync(fakeXcodebuildDir, { recursive: true });
    fs.writeFileSync(path.join(fakeXcodebuildDir, "xcodebuild"), "#!/usr/bin/env bash\nexit 0\n");
    fs.chmodSync(path.join(fakeXcodebuildDir, "xcodebuild"), 0o755);

    const before = fs.readFileSync(NOTICES_PATH, "utf8");
    const result = spawnSync(
      "bash",
      [BUILD_MAC_APP_PATH, "--configuration", "Release", "--allow-development-license-key-for-pr"],
      {
        cwd: REPO_ROOT,
        encoding: "utf8",
        env: {
          ...process.env,
          DEVELOPER_DIR: fakeDeveloperDir,
          DOC2MD_RELEASE_REF: "",
        },
      },
    );

    const output = [result.stdout, result.stderr].filter(Boolean).join("\n");
    expect(result.status).not.toBe(0);
    expect(output).toContain("Invalid DOC2MD_RELEASE_REF");
    expect(fs.readFileSync(NOTICES_PATH, "utf8")).toBe(before);
  });
});
