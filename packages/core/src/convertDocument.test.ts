import { afterEach, describe, expect, it, vi } from "vitest";
import { convertDocument } from "./index";
import { createTempDir, fixturePath, readOutput } from "./test-helpers";

describe("convertDocument", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

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

  it("downloads and converts a remote document URL", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({
          "content-disposition": 'attachment; filename="remote-notes.txt"'
        }),
        blob: vi.fn().mockResolvedValue(new Blob(["remote"], { type: "text/plain" }))
      })
    );
    const outputDir = await createTempDir("doc2md-core-single-remote-");
    const result = await convertDocument("https://example.com/download?id=7", {
      outputDir
    });

    expect(result.status).toBe("success");
    expect(result.inputPath).toBe("https://example.com/download?id=7");
    expect(result.outputPath?.endsWith("remote-notes.md")).toBe(true);

    const contents = await readOutput(result.outputPath!);
    expect(contents.trim()).toBe("remote");
  });
});
