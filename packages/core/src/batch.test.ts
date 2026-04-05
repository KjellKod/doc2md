import path from "node:path";
import { access } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { BatchLimitExceededError, convertDocuments } from "./index";
import { createTempDir, fixturePath } from "./test-helpers";

async function pathExists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

describe("convertDocuments", () => {
  it("throws BatchLimitExceededError before processing and writes no outputs", async () => {
    const outputDir = await createTempDir("doc2md-core-limit-");
    const inputs = Array.from({ length: 51 }, () => fixturePath("sample.txt"));

    await expect(
      convertDocuments(inputs, {
        outputDir,
        maxDocuments: 50
      })
    ).rejects.toBeInstanceOf(BatchLimitExceededError);

    expect(await pathExists(`${outputDir}/sample.md`)).toBe(false);
  });

  it("skips unsupported files and continues supported inputs without inline markdown", async () => {
    const outputDir = await createTempDir("doc2md-core-batch-");
    const result = await convertDocuments(
      [fixturePath("sample.txt"), fixturePath("persona_test.md"), `${fixturePath("sample.txt")}.exe`],
      {
        outputDir
      }
    );

    expect(result.results).toHaveLength(3);
    expect(result.results[0].status).toBe("success");
    expect(result.results[1].status).toBe("success");
    expect(result.results[2].status).toBe("skipped");
    expect(result.summary.skipped).toBe(1);
    expect("markdown" in result.results[0]).toBe(false);
  });

  it("returns a per-document error result when one input path cannot be read", async () => {
    const outputDir = await createTempDir("doc2md-core-batch-error-");
    const missingPath = path.join(outputDir, "missing.txt");
    const result = await convertDocuments(
      [fixturePath("sample.txt"), missingPath, fixturePath("persona_test.md")],
      {
        outputDir
      }
    );

    expect(result.results).toHaveLength(3);
    expect(result.results[0].status).toBe("success");
    expect(result.results[1].status).toBe("error");
    expect(result.results[1].outputPath).toBeNull();
    expect(result.results[1].error).toBeTruthy();
    expect(result.results[1].warnings[0]).toBe(result.results[1].error);
    expect(result.results[2].status).toBe("success");
    expect(result.summary.failed).toBe(1);
    expect(result.summary.succeeded).toBe(2);
  });
});
