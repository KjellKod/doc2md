import path from "node:path";
import { access } from "node:fs/promises";
import { afterEach, describe, expect, it, vi } from "vitest";
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
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

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

  it("converts mixed local paths and remote URLs in one batch", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({
          "content-disposition": 'attachment; filename="remote-brief.txt"'
        }),
        blob: vi.fn().mockResolvedValue(new Blob(["remote brief"], { type: "text/plain" }))
      })
    );
    const outputDir = await createTempDir("doc2md-core-batch-remote-");
    const result = await convertDocuments(
      [fixturePath("sample.txt"), "https://example.com/download?brief=1"],
      {
        outputDir
      }
    );

    expect(result.results).toHaveLength(2);
    expect(result.results[0].status).toBe("success");
    expect(result.results[1].status).toBe("success");
    expect(result.results[1].inputPath).toBe("https://example.com/download?brief=1");
    expect(result.results[1].outputPath?.endsWith("remote-brief.md")).toBe(true);
  });

  it("supports both GitHub blob and raw URL shapes", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      url: "https://raw.githubusercontent.com/KjellKod/doc2md/refs/heads/main/README.md",
      headers: new Headers(),
      blob: vi.fn().mockResolvedValue(new Blob(["# doc2md"], { type: "text/markdown" }))
    });
    vi.stubGlobal("fetch", fetchMock);
    const outputDir = await createTempDir("doc2md-core-batch-github-");

    const result = await convertDocuments(
      [
        "https://github.com/KjellKod/doc2md/blob/main/README.md",
        "https://raw.githubusercontent.com/KjellKod/doc2md/refs/heads/main/README.md"
      ],
      {
        outputDir
      }
    );

    expect(result.results).toHaveLength(2);
    expect(result.results[0].status).toBe("success");
    expect(result.results[1].status).toBe("success");
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://github.com/KjellKod/doc2md/blob/main/README.md?raw=1",
      expect.objectContaining({
        signal: expect.any(AbortSignal)
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://raw.githubusercontent.com/KjellKod/doc2md/refs/heads/main/README.md",
      expect.objectContaining({
        signal: expect.any(AbortSignal)
      })
    );
    expect(
      result.results
        .map((entry) => path.basename(entry.outputPath ?? ""))
        .sort()
    ).toEqual(["README-1.md", "README.md"]);
  });

  it("returns a per-document error for remote download timeouts without failing the batch", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn((_input, init?: RequestInit) => {
      return new Promise((_, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("Aborted", "AbortError"));
        });
      });
    }));
    const outputDir = await createTempDir("doc2md-core-batch-timeout-");

    const pending = convertDocuments(
      [fixturePath("sample.txt"), "https://example.com/slow.docx"],
      {
        outputDir,
        remoteTimeoutMs: 30_000
      }
    );

    await vi.advanceTimersByTimeAsync(30_000);

    const result = await pending;

    expect(result.results[0].status).toBe("success");
    expect(result.results[1].status).toBe("error");
    expect(result.results[1].error).toContain("timed out");
    expect(result.summary.failed).toBe(1);
  });
});
