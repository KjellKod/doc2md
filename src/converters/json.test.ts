import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CORRUPT_FILE_MESSAGE, EMPTY_FILE_MESSAGE } from "./messages";
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
    const fixture = fs.readFileSync(
      path.resolve(process.cwd(), "test-fixtures/sample-malformed.json")
    );
    const file = new File([fixture], "broken.json", {
      type: "application/json"
    });

    const result = await convertJson(file);

    expect(result.status).toBe("error");
    expect(result.warnings).toEqual([CORRUPT_FILE_MESSAGE]);
  });

  it("handles an empty JSON file", async () => {
    const file = new File(["   "], "empty.json", {
      type: "application/json"
    });

    const result = await convertJson(file);

    expect(result).toEqual({
      markdown: "",
      warnings: [EMPTY_FILE_MESSAGE],
      status: "error"
    });
  });
});
