import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const script = readFileSync("scripts/build-mac-app.sh", "utf8");

function pattern(name: string) {
  const match = script.match(new RegExp(`${name}='([^']+)'`));
  if (!match) {
    throw new Error(`Missing ${name}`);
  }

  return new RegExp(match[1].replace(/\[\[:space:\]\]\*/g, "\\s*"));
}

function scanFixture(lines: string[]) {
  const watchedPattern = pattern("WATCHED_NATIVE_API_PATTERN");
  const allowedPattern = pattern("ALLOWED_NATIVE_API_PATTERN");
  const forbiddenPattern = pattern("FORBIDDEN_NATIVE_API_PATTERN");

  for (const [index, line] of lines.entries()) {
    const match = `fixture.swift:${index + 1}:${line}`;
    if (forbiddenPattern.test(line)) {
      return match;
    }

    if (watchedPattern.test(line) && !allowedPattern.test(line)) {
      return match;
    }
  }

  return null;
}

describe("Mac native API allowlist", () => {
  it("scans every first-party Swift source touched by persistence work", () => {
    expect(script).toContain(
      'PERSISTENCE_SWIFT_SOURCE_GLOB="apps/macos/doc2md/*.swift"',
    );
    expect(script).toContain(
      "native API allowlist scan found no Swift sources",
    );
  });

  it("documents the approved Phase 4 native APIs with named justifications", () => {
    expect(script).toContain(
      "FileManager :: stat/read/temp-file creation/atomic replacement staging for user-selected Markdown files",
    );
    expect(script).toContain(
      "NSOpenPanel :: user-selected supported-document open panel",
    );
    expect(script).toContain(
      "NSSavePanel :: user-selected Markdown Save As target panel",
    );
    expect(script).toContain(
      "NSWorkspace :: Reveal in Finder for a saved user-selected file",
    );
    expect(script).toContain(
      "replaceItemAt :: atomic final replacement from a sibling temp file",
    );
    expect(script).toContain(
      "startAccessingSecurityScopedResource :: current-session scoped file access around selected URLs",
    );
    expect(script).toContain(
      "stopAccessingSecurityScopedResource :: balanced release of scoped file access",
    );
  });

  it("keeps unexpected broad file APIs in the watched failure policy", () => {
    expect(script).toContain("WATCHED_NATIVE_API_PATTERN=");
    expect(script).toContain("FORBIDDEN_NATIVE_API_PATTERN=");
    expect(script).toContain("FileHandle");
    expect(script).toContain("moveItem");
    expect(script).toContain("copyItem");
    expect(script).toContain("\\.write\\(to:");
    expect(script).toContain("unexpected native file API outside allowlist");
  });

  it("fails loudly if the grep scan itself errors", () => {
    expect(script).toContain("grep_matches_or_fail()");
    expect(script).toContain("native API allowlist scan failed with grep status");
    expect(script).not.toContain('|| true)');
  });

  it("fails mixed allowed and forbidden native API lines", () => {
    expect(
      scanFixture([
        "let fm = FileManager.default; try fm.moveItem(at: src, to: dst)",
      ]),
    ).toContain("moveItem");
    expect(
      scanFixture([
        "let fm = FileManager.default; let handle = FileHandle(forReadingAtPath: path)",
      ]),
    ).toContain("FileHandle");
  });
});
