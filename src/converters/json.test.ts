import { describe, expect, it } from "vitest";
import { convertJson } from "./json";

describe("convertJson", () => {
  it("pretty-prints valid JSON inside a fenced code block", async () => {
    const file = new File(['{"name":"doc2md","active":true}'], "sample.json", {
      type: "application/json"
    });

    const result = await convertJson(file);

    expect(result).toEqual({
      markdown: '```json\n{\n  "name": "doc2md",\n  "active": true\n}\n```',
      warnings: [],
      status: "success"
    });
  });

  it("handles malformed JSON gracefully", async () => {
    const file = new File(['{"name": }'], "broken.json", {
      type: "application/json"
    });

    const result = await convertJson(file);

    expect(result.status).toBe("error");
    expect(result.warnings).toEqual([
      "This JSON file could not be parsed. Please check that it is valid JSON."
    ]);
  });

  it("handles an empty JSON file", async () => {
    const file = new File(["   "], "empty.json", {
      type: "application/json"
    });

    const result = await convertJson(file);

    expect(result).toEqual({
      markdown: "",
      warnings: ["This JSON file is empty."],
      status: "error"
    });
  });
});
