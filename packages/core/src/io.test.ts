import path from "node:path";
import { describe, expect, it } from "vitest";
import { createTempDir, readOutput } from "./test-helpers";
import { writeMarkdownOutput } from "./io";

describe("core io", () => {
  it("uses numeric suffixes for duplicate basenames", async () => {
    const outputDir = await createTempDir("doc2md-core-io-");

    const firstPath = await writeMarkdownOutput(outputDir, "/tmp/a/resume.pdf", "# One");
    const secondPath = await writeMarkdownOutput(outputDir, "/tmp/b/resume.pdf", "# Two");
    const thirdPath = await writeMarkdownOutput(outputDir, "/tmp/c/resume.pdf", "# Three");

    expect(firstPath.endsWith("resume.md")).toBe(true);
    expect(secondPath.endsWith("resume-1.md")).toBe(true);
    expect(thirdPath.endsWith("resume-2.md")).toBe(true);
  });

  it("writes duplicate basenames concurrently without overwriting outputs", async () => {
    const outputDir = await createTempDir("doc2md-core-io-race-");
    const outputs = await Promise.all([
      writeMarkdownOutput(outputDir, "/tmp/a/resume.pdf", "# One"),
      writeMarkdownOutput(outputDir, "/tmp/b/resume.pdf", "# Two")
    ]);

    expect(new Set(outputs).size).toBe(2);
    expect(outputs.map((output) => path.basename(output)).sort()).toEqual([
      "resume-1.md",
      "resume.md"
    ]);

    const contents = await Promise.all(outputs.map((output) => readOutput(output)));
    expect(contents.sort()).toEqual(["# One", "# Two"]);
  });
});
