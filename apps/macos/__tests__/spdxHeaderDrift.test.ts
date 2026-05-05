// @vitest-environment node
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..", "..");
const SCRIPT_PATH = path.join(REPO_ROOT, "scripts", "generate-release-commit.mjs");
const SWIFT_ROOT = path.join(REPO_ROOT, "apps", "macos", "doc2md");

const TARGETED_FILES = [
  "AboutWindow.swift",
  "AboutWindowController.swift",
  "ThirdPartyLicensesWindow.swift",
  "ReleaseCommit.generated.swift",
];

const EXPECTED_HEADER = "// SPDX-License-Identifier: LicenseRef-doc2md-Desktop";

describe("SPDX header drift", () => {
  // Self-bootstrap the gitignored generated file so this test does not depend on
  // Vitest inter-file ordering. Without this, a fresh checkout that has never run
  // the generator would fail before releaseCommitDrift runs.
  beforeAll(() => {
    execFileSync("node", [SCRIPT_PATH], { cwd: REPO_ROOT, stdio: "pipe" });
  });

  it.each(TARGETED_FILES)("%s starts with the SPDX-License-Identifier header", (relativePath) => {
    const fullPath = path.join(SWIFT_ROOT, relativePath);
    const contents = fs.readFileSync(fullPath, "utf8");
    const firstLine = contents.split("\n", 1)[0];
    expect(firstLine).toBe(EXPECTED_HEADER);
  });
});
