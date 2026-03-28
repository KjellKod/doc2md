import { describe, expect, it } from "vitest";
import { convertTxt } from "./txt";

describe("convertTxt", () => {
  it("converts plain text to markdown", async () => {
    const file = new File(["Hello from doc2md"], "sample.txt", {
      type: "text/plain"
    });

    const result = await convertTxt(file);

    expect(result).toEqual({
      markdown: "Hello from doc2md",
      warnings: [],
      status: "success"
    });
  });

  it("normalizes CRLF and CR line endings", async () => {
    const file = new File(["line one\r\nline two\rline three"], "sample.txt", {
      type: "text/plain"
    });

    const result = await convertTxt(file);

    expect(result.markdown).toBe("line one\nline two\nline three");
    expect(result.status).toBe("success");
  });

  it("handles an empty file", async () => {
    const file = new File([""], "empty.txt", {
      type: "text/plain"
    });

    const result = await convertTxt(file);

    expect(result).toEqual({
      markdown: "",
      warnings: [],
      status: "success"
    });
  });
});
