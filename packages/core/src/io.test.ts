import path from "node:path";
import { describe, expect, it } from "vitest";
import { createTempDir, readOutput } from "./test-helpers";
import { writeConversionOutput, writeMarkdownOutput } from "./io";

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

  it("writes a single .html file for format html", async () => {
    const outputDir = await createTempDir("doc2md-core-io-html-");
    const result = await writeConversionOutput({
      outputDir,
      inputName: "/tmp/a/notes.pdf",
      format: "html",
      markdown: "# Notes",
      html: "<!DOCTYPE html><html></html>"
    });

    expect(result.outputPath.endsWith("notes.html")).toBe(true);
    expect(result.outputPaths).toEqual({ html: result.outputPath });
    expect(await readOutput(result.outputPath)).toBe(
      "<!DOCTYPE html><html></html>"
    );
  });

  it("writes both .md and .html with a shared suffix for format both", async () => {
    const outputDir = await createTempDir("doc2md-core-io-both-");
    const result = await writeConversionOutput({
      outputDir,
      inputName: "/tmp/a/resume.pdf",
      format: "both",
      markdown: "# Resume",
      html: "<!DOCTYPE html><html></html>"
    });

    expect(result.outputPath.endsWith("resume.md")).toBe(true);
    expect(result.outputPaths.md?.endsWith("resume.md")).toBe(true);
    expect(result.outputPaths.html?.endsWith("resume.html")).toBe(true);
    expect(await readOutput(result.outputPaths.md!)).toBe("# Resume");
    expect(await readOutput(result.outputPaths.html!)).toBe(
      "<!DOCTYPE html><html></html>"
    );
  });

  it("keeps both-format suffixes paired across duplicate basenames", async () => {
    const outputDir = await createTempDir("doc2md-core-io-both-dupe-");
    const first = await writeConversionOutput({
      outputDir,
      inputName: "/tmp/a/resume.pdf",
      format: "both",
      markdown: "# One",
      html: "<p>one</p>"
    });
    const second = await writeConversionOutput({
      outputDir,
      inputName: "/tmp/b/resume.pdf",
      format: "both",
      markdown: "# Two",
      html: "<p>two</p>"
    });

    expect(path.basename(first.outputPaths.md!)).toBe("resume.md");
    expect(path.basename(first.outputPaths.html!)).toBe("resume.html");
    expect(path.basename(second.outputPaths.md!)).toBe("resume-1.md");
    expect(path.basename(second.outputPaths.html!)).toBe("resume-1.html");
  });

  it("keeps both-format suffixes paired under concurrent writes", async () => {
    const outputDir = await createTempDir("doc2md-core-io-both-race-");
    const [first, second] = await Promise.all([
      writeConversionOutput({
        outputDir,
        inputName: "/tmp/a/resume.pdf",
        format: "both",
        markdown: "# One",
        html: "<p>one</p>"
      }),
      writeConversionOutput({
        outputDir,
        inputName: "/tmp/b/resume.pdf",
        format: "both",
        markdown: "# Two",
        html: "<p>two</p>"
      })
    ]);

    // Each result's .md and .html must share the same suffix stem so the
    // pair refers to one logical document. No mismatched suffixes allowed.
    for (const result of [first, second]) {
      const mdStem = path.basename(result.outputPaths.md!, ".md");
      const htmlStem = path.basename(result.outputPaths.html!, ".html");
      expect(mdStem).toBe(htmlStem);
    }

    const allBasenames = [
      first.outputPaths.md!,
      first.outputPaths.html!,
      second.outputPaths.md!,
      second.outputPaths.html!
    ].map((output) => path.basename(output));
    expect(new Set(allBasenames).size).toBe(4);
    expect(allBasenames.sort()).toEqual([
      "resume-1.html",
      "resume-1.md",
      "resume.html",
      "resume.md"
    ]);
  });

  it("rejects invalid runtime output formats instead of falling through", async () => {
    const outputDir = await createTempDir("doc2md-core-io-format-");

    await expect(
      writeConversionOutput({
        outputDir,
        inputName: "/tmp/a/resume.pdf",
        format: "pdf",
        markdown: "# Resume"
      } as Parameters<typeof writeConversionOutput>[0])
    ).rejects.toThrow(
      'Invalid value for format: expected one of md, html, both, got "pdf".'
    );
  });
});
