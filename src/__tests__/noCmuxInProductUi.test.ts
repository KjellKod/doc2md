// @vitest-environment node
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..");
const MACOS_ROOT = path.join(REPO_ROOT, "apps", "macos");
const README_PATH = path.join(MACOS_ROOT, "README.md");
const SWIFT_ROOT = MACOS_ROOT;

function listSwiftFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listSwiftFiles(full));
    } else if (entry.isFile() && entry.name.endsWith(".swift")) {
      files.push(full);
    }
  }
  return files;
}

describe("no cmux references in product UI", () => {
  it("does not appear in apps/macos/**/*.swift or apps/macos/README.md", () => {
    const swiftFiles = listSwiftFiles(SWIFT_ROOT);
    const offenders: string[] = [];
    for (const file of swiftFiles) {
      const contents = fs.readFileSync(file, "utf8");
      if (contents.includes("cmux")) {
        offenders.push(path.relative(REPO_ROOT, file));
      }
    }
    const readme = fs.readFileSync(README_PATH, "utf8");
    if (readme.includes("cmux")) {
      offenders.push(path.relative(REPO_ROOT, README_PATH));
    }
    expect(offenders, `cmux must not appear in product UI: ${offenders.join(", ")}`).toEqual([]);
  });
});

describe("desktop product license surfacing stays scoped", () => {
  it("LicenseRef-doc2md-Desktop is only referenced from the app-owned licensing surface", () => {
    const swiftFiles = listSwiftFiles(SWIFT_ROOT);
    const offenders: string[] = [];
    const allowedFiles = new Set(["apps/macos/doc2md/ThirdPartyLicensesWindow.swift"]);

    for (const file of swiftFiles) {
      const contents = fs.readFileSync(file, "utf8");
      const lines = contents.split("\n");
      // Allow the SPDX-License-Identifier header line that names the license,
      // because that is a source-license declaration, not an in-app affordance.
      const hasNonHeaderReference = lines.some((line, index) => {
        if (!line.includes("LicenseRef-doc2md-Desktop")) {
          return false;
        }
        if (index === 0 && line.startsWith("// SPDX-License-Identifier:")) {
          return false;
        }
        return true;
      });
      const relativePath = path.relative(REPO_ROOT, file);
      if (hasNonHeaderReference && !allowedFiles.has(relativePath)) {
        offenders.push(relativePath);
      }
    }
    expect(
      offenders,
      `LicenseRef-doc2md-Desktop must only be surfaced from the app-owned licensing surface: ${offenders.join(", ")}`,
    ).toEqual([]);
  });
});
