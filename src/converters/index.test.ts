import { describe, expect, it } from "vitest";
import { UNSUPPORTED_FILE_MESSAGE, convertFile } from "./index";

describe("convertFile", () => {
  it("routes .txt files to the text converter", async () => {
    const file = new File(["Plain text"], "notes.TXT", {
      type: "text/plain"
    });

    const result = await convertFile(file);

    expect(result).toEqual({
      markdown: "Plain text",
      warnings: [],
      status: "success"
    });
  });

  it("routes .json files to the JSON converter", async () => {
    const file = new File(['{"count":2}'], "data.json", {
      type: "application/json"
    });

    const result = await convertFile(file);

    expect(result.markdown).toContain("```json");
    expect(result.status).toBe("success");
  });

  it("returns an error for unsupported extensions", async () => {
    const file = new File(["binary"], "report.pdf", {
      type: "application/pdf"
    });

    const result = await convertFile(file);

    expect(result).toEqual({
      markdown: "",
      warnings: [UNSUPPORTED_FILE_MESSAGE],
      status: "error"
    });
  });
});
