import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { convertDocument } from "./index";
import { createTempDir, fixturePath, readOutput } from "./test-helpers";

const supportedFixtures = [
  "sample.txt",
  "persona_test.md",
  "sample.json",
  "sample.csv",
  "sample.tsv",
  "sample.html",
  "sample.docx",
  "sample.xlsx",
  "sample.pdf",
  "sample.pptx"
];

describe("core conversions", () => {
  it.each(supportedFixtures)("converts %s in Node and writes markdown output", async (fixture) => {
    const outputDir = await createTempDir(`doc2md-core-${fixture}-`);
    const result = await convertDocument(fixturePath(fixture), {
      outputDir
    });

    expect(["success", "warning"]).toContain(result.status);
    expect(result.outputPath).toBeTruthy();
    const contents = await readOutput(result.outputPath!);
    expect(contents.trim().length).toBeGreaterThan(0);
  }, 30_000);

  it("matches the browser-generated PDF quality golden artifact", async () => {
    const outputDir = await createTempDir("doc2md-core-pdf-");
    const result = await convertDocument(fixturePath("sample.pdf"), {
      outputDir
    });
    const golden = JSON.parse(
      await readFile(fixturePath("sample.pdf.browser-golden.json"), "utf8")
    );

    expect(result.quality).toEqual(golden.quality);
  });
});
