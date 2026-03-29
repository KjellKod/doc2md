import { describe, expect, it } from "vitest";
import { convertMd } from "./md";

function createMdFile(contents: string, fileName = "readme.md") {
  return new File([contents], fileName, { type: "text/markdown" });
}

describe("convertMd", () => {
  it("passes markdown through unchanged", async () => {
    const input = "# Hello\n\nThis is **bold** and *italic*.";
    const result = await convertMd(createMdFile(input));

    expect(result.status).toBe("success");
    expect(result.markdown).toBe(input);
    expect(result.warnings).toEqual([]);
  });

  it("returns error for empty files", async () => {
    const result = await convertMd(createMdFile(""));
    expect(result.status).toBe("error");
  });

  it("normalizes line endings", async () => {
    const result = await convertMd(createMdFile("line one\r\nline two\r\n"));
    expect(result.status).toBe("success");
    expect(result.markdown).not.toContain("\r");
  });
});
