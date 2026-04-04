import { describe, expect, it } from "vitest";
import { convertDocument } from "./index";
import { createTempDir, fixturePath, readOutput } from "./test-helpers";

describe("convertDocument", () => {
  it("writes one output file and returns document metadata without inline markdown", async () => {
    const outputDir = await createTempDir("doc2md-core-single-");
    const result = await convertDocument(fixturePath("sample.txt"), {
      outputDir
    });

    expect(result.status).toBe("success");
    expect(result.outputPath).toBeTruthy();
    expect("markdown" in result).toBe(false);

    const contents = await readOutput(result.outputPath!);
    expect(contents.trim().length).toBeGreaterThan(0);
  });
});
