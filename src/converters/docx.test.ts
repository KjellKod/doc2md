import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CORRUPT_FILE_MESSAGE } from "./messages";
import { convertDocx } from "./docx";
import * as office from "./office";

const DOCX_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function createDocxFile(contents: BlobPart[] = [new Uint8Array([1, 2, 3])]) {
  return new File(contents, "sample.docx", {
    type: DOCX_MIME_TYPE
  });
}

describe("convertDocx", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("converts the sample DOCX fixture to Markdown", async () => {
    const fixture = fs.readFileSync(path.resolve(process.cwd(), "test-fixtures/sample.docx"));
    const file = createDocxFile([fixture]);

    const result = await convertDocx(file);

    expect(result).toMatchObject({
      warnings: [],
      status: "success"
    });
    expect(result.quality).toBeUndefined();
    expect(result.markdown).toContain("**Sample Document**");
    expect(result.markdown).toContain("# Overview");
    expect(result.markdown).toContain("- Clear heading hierarchy for easy scanning");
    expect(result.markdown).toContain("| Item | Owner | Status |");
    expect(result.markdown).toContain("| Timeline | Jordan | Ready |");
  });

  it("includes mammoth warnings and downgrades the status", async () => {
    vi.spyOn(office, "convertDocxToHtml").mockResolvedValue({
      value: "<h1>Overview</h1><p>Body copy.</p>",
      messages: [{ message: "Unrecognized paragraph style: Aside" }],
      imageCount: 0
    });

    const result = await convertDocx(createDocxFile());

    expect(result.status).toBe("warning");
    expect(result.warnings).toEqual(["Unrecognized paragraph style: Aside"]);
    expect(result.markdown).toContain("# Overview");
    expect(result.markdown).toContain("Body copy.");
    expect(result.quality).toBeUndefined();
  });

  it("strips embedded images from markdown and surfaces the count via quality", async () => {
    // Reproduces the bug where Mammoth's default behaviour inlined images as
    // base64 data URIs, ballooning .md output to hundreds of KB per image.
    vi.spyOn(office, "convertDocxToHtml").mockResolvedValue({
      value: "<h1>Title</h1><p>Body copy with no image tags here.</p>",
      messages: [],
      imageCount: 2
    });

    const result = await convertDocx(createDocxFile());

    expect(result.markdown).not.toMatch(/data:image\//);
    expect(result.markdown).not.toMatch(/!\[\]\(/);
    expect(result.markdown).toContain("# Title");
    expect(result.status).toBe("warning");
    expect(result.warnings).toEqual([]);
    expect(result.quality).toEqual({
      level: "review",
      summary:
        "Review: Document converted. 2 image(s) detected that could not be converted to markdown."
    });
  });

  it("treats an image-only document as a warning rather than empty", async () => {
    vi.spyOn(office, "convertDocxToHtml").mockResolvedValue({
      value: "",
      messages: [],
      imageCount: 3
    });

    const result = await convertDocx(createDocxFile());

    expect(result.status).toBe("warning");
    expect(result.markdown).toBe("");
    expect(result.quality?.summary).toContain("3 image(s) detected");
  });

  it("handles corrupt DOCX files with an error result", async () => {
    vi.spyOn(office, "convertDocxToHtml").mockRejectedValue(new Error("bad zip"));

    const result = await convertDocx(createDocxFile());

    expect(result).toEqual({
      markdown: "",
      warnings: [CORRUPT_FILE_MESSAGE],
      status: "error"
    });
  });
});
