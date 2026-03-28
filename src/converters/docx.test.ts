import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
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
    expect(result.markdown).toContain("**Sample Document**");
    expect(result.markdown).toContain("# Overview");
    expect(result.markdown).toContain("- Clear heading hierarchy for easy scanning");
    expect(result.markdown).toContain("| Item | Owner | Status |");
    expect(result.markdown).toContain("| Timeline | Jordan | Ready |");
  });

  it("includes mammoth warnings and downgrades the status", async () => {
    vi.spyOn(office, "convertDocxToHtml").mockResolvedValue({
      value: "<h1>Overview</h1><p>Body copy.</p>",
      messages: [{ type: "warning", message: "Unrecognized paragraph style: Aside" }]
    });

    const result = await convertDocx(createDocxFile());

    expect(result.status).toBe("warning");
    expect(result.warnings).toEqual(["Unrecognized paragraph style: Aside"]);
    expect(result.markdown).toContain("# Overview");
    expect(result.markdown).toContain("Body copy.");
  });

  it("handles corrupt DOCX files with an error result", async () => {
    vi.spyOn(office, "convertDocxToHtml").mockRejectedValue(new Error("bad zip"));

    const result = await convertDocx(createDocxFile());

    expect(result).toEqual({
      markdown: "",
      warnings: [
        "This DOCX file could not be read. It may be corrupted or use unsupported content."
      ],
      status: "error"
    });
  });
});
