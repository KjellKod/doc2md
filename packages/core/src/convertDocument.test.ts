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

  it("defaults to Markdown-only output", async () => {
    const outputDir = await createTempDir("doc2md-core-fmt-default-");
    const result = await convertDocument(fixturePath("sample.txt"), {
      outputDir
    });

    expect(result.outputPath?.endsWith(".md")).toBe(true);
    expect(result.outputPaths).toEqual({ md: result.outputPath });
  });

  it("writes only HTML for format html", async () => {
    const outputDir = await createTempDir("doc2md-core-fmt-html-");
    const result = await convertDocument(fixturePath("sample.txt"), {
      outputDir,
      format: "html"
    });

    expect(result.status).toBe("success");
    expect(result.outputPath?.endsWith(".html")).toBe(true);
    expect(result.outputPaths?.md).toBeUndefined();
    expect(result.outputPaths?.html?.endsWith(".html")).toBe(true);

    const contents = await readOutput(result.outputPaths!.html!);
    expect(contents).toContain("<!DOCTYPE html>");
    expect(contents).toContain("<style>");
  });

  it("writes both Markdown and HTML for format both and returns outputPaths", async () => {
    const outputDir = await createTempDir("doc2md-core-fmt-both-");
    const result = await convertDocument(fixturePath("sample.txt"), {
      outputDir,
      format: "both"
    });

    expect(result.status).toBe("success");
    // outputPath stays backward-compatible as the Markdown path.
    expect(result.outputPath?.endsWith(".md")).toBe(true);
    expect(result.outputPaths?.md?.endsWith(".md")).toBe(true);
    expect(result.outputPaths?.html?.endsWith(".html")).toBe(true);

    const mdStem = result.outputPaths!.md!.replace(/\.md$/, "");
    const htmlStem = result.outputPaths!.html!.replace(/\.html$/, "");
    expect(mdStem).toBe(htmlStem);

    const html = await readOutput(result.outputPaths!.html!);
    expect(html).toContain("<!DOCTYPE html>");
  });
});
