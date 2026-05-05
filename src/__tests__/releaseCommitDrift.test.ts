// @vitest-environment node
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..");
const SCRIPT_PATH = path.join(REPO_ROOT, "scripts", "generate-release-commit.mjs");
const OUTPUT_PATH = path.join(
  REPO_ROOT,
  "apps",
  "macos",
  "doc2md",
  "ReleaseCommit.generated.swift",
);

const SPDX_HEADER = "// SPDX-License-Identifier: LicenseRef-doc2md-Desktop";
const VALUE_LINE_PATTERN = /^\s*static let value: String = "([0-9a-f]{7}|unknown)"$/m;

describe("release commit drift", () => {
  beforeAll(() => {
    execFileSync("node", [SCRIPT_PATH], { cwd: REPO_ROOT, stdio: "pipe" });
  });

  it("emits a Swift file whose first line is the SPDX header", () => {
    const contents = fs.readFileSync(OUTPUT_PATH, "utf8");
    const firstLine = contents.split("\n", 1)[0];
    expect(firstLine).toBe(SPDX_HEADER);
  });

  it("emits a 7-char hex commit or the literal unknown", () => {
    const contents = fs.readFileSync(OUTPUT_PATH, "utf8");
    expect(contents).toMatch(VALUE_LINE_PATTERN);
  });

  it("normalizes a full 40-char hex DOC2MD_RELEASE_COMMIT override to 7 chars", () => {
    const fullSha = "abcdef0123456789abcdef0123456789abcdef01";
    execFileSync("node", [SCRIPT_PATH], {
      cwd: REPO_ROOT,
      stdio: "pipe",
      env: { ...process.env, DOC2MD_RELEASE_COMMIT: fullSha },
    });
    const contents = fs.readFileSync(OUTPUT_PATH, "utf8");
    const match = contents.match(VALUE_LINE_PATTERN);
    expect(match?.[1]).toBe(fullSha.slice(0, 7));
    // Restore the auto-detected value so other tests see a consistent file.
    execFileSync("node", [SCRIPT_PATH], { cwd: REPO_ROOT, stdio: "pipe" });
  });
});
