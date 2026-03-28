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

  it("routes .csv files to the CSV converter", async () => {
    const file = new File(["name,role\nJean-Claude,Reviewer"], "people.csv", {
      type: "text/csv"
    });

    const result = await convertFile(file);

    expect(result.markdown).toContain("| name | role |");
    expect(result.status).toBe("success");
  });

  it("routes .tsv files to the TSV converter", async () => {
    const file = new File(["name\trole\nDexter\tBuilder"], "people.tsv", {
      type: "text/tab-separated-values"
    });

    const result = await convertFile(file);

    expect(result.markdown).toContain("| name | role |");
    expect(result.status).toBe("success");
  });

  it("routes .html files to the HTML converter", async () => {
    const file = new File(["<h1>Title</h1><p>Body</p>"], "page.html", {
      type: "text/html"
    });

    const result = await convertFile(file);

    expect(result.markdown).toContain("# Title");
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
