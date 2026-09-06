// @vitest-environment node
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..", "..");
const SCRIPT_PATH = path.join(REPO_ROOT, "scripts", "generate-release-commit.mjs");
const EXPECTED_MARKER = "SPDX-License-Identifier: LicenseRef-doc2md-Desktop";

const TARGETED_FILES = [
  ["apps/macos/doc2md", "AboutWindow.swift", "// "],
  ["apps/macos/doc2md", "AboutWindowController.swift", "// "],
  ["apps/macos/doc2md", "ThirdPartyLicensesWindow.swift", "// "],
  ["apps/macos/doc2md", "ReleaseCommit.generated.swift", "// "],
  ["apps/macos/doc2md", "DocumentLibraryStore.swift", "// "],
  ["apps/macos/doc2md", "DocumentLibraryTestHooks.swift", "// "],
  ["apps/macos/doc2md", "DocumentLibraryWindow.swift", "// "],
  ["apps/macos/doc2mdTests", "DocumentLibraryStoreTests.swift", "// "],
  ["apps/macos/doc2mdTests", "DocumentLibraryWindowTests.swift", "// "],
  ["apps/macos/doc2mdTests", "ShellBridgeDocumentLibraryTests.swift", "// "],
  ["src/desktop/__tests__", "macBuildAllowlist.test.ts", "// "],
  ["scripts", "verify-document-library-smoke-build.sh", "# "],
] as const;

describe("SPDX header drift", () => {
  // Self-bootstrap the gitignored generated file so this test does not depend on
  // Vitest inter-file ordering. A fresh checkout has not run the generator yet.
  beforeAll(() => {
    execFileSync("node", [SCRIPT_PATH], { cwd: REPO_ROOT, stdio: "pipe" });
  });

  it.each(TARGETED_FILES)("%s/%s has the desktop SPDX header", (root, relativePath, prefix) => {
    const contents = fs.readFileSync(path.join(REPO_ROOT, root, relativePath), "utf8");
    const lines = contents.split("\n");
    const markerLine = lines[0].startsWith("#!") ? lines[1] : lines[0];
    expect(markerLine).toBe(`${prefix}${EXPECTED_MARKER}`);
  });
});
