import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UNSUPPORTED_FILE_MESSAGE, convertFile } from "./index";
import * as office from "./office";

describe("convertFile", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

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

  it("routes .docx files to the DOCX converter", async () => {
    vi.spyOn(office, "convertDocxToHtml").mockResolvedValue({
      value: "<h1>Overview</h1><p>Body copy.</p>",
      messages: []
    });
    const file = new File([new Uint8Array([1, 2, 3])], "report.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    });

    const result = await convertFile(file);

    expect(result.markdown).toContain("# Overview");
    expect(result.status).toBe("success");
  });

  it("routes .xlsx files to the XLSX converter", async () => {
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        ["Project", "Owner"],
        ["Atlas", "Jordan"]
      ]),
      "Projects"
    );
    vi.spyOn(office, "readWorkbook").mockReturnValue(workbook);
    const file = new File([new Uint8Array([1, 2, 3])], "report.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });

    const result = await convertFile(file);

    expect(result.markdown).toContain("## Sheet: Projects");
    expect(result.status).toBe("success");
  });

  it("routes .pdf files to the PDF converter", async () => {
    const fixture = fs.readFileSync(path.resolve(process.cwd(), "test-fixtures/sample.pdf"));
    const file = new File([fixture], "report.pdf", {
      type: "application/pdf"
    });

    const result = await convertFile(file);

    expect(result.markdown).toContain("## Page 1");
    expect(result.status).toBe("success");
  });

  it("routes .pptx files to the PPTX converter", async () => {
    const fixture = fs.readFileSync(path.resolve(process.cwd(), "test-fixtures/sample.pptx"));
    const file = new File([fixture], "deck.pptx", {
      type: "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    });

    const result = await convertFile(file);

    expect(result.markdown).toContain("## Slide 1: Sample Presentation");
    expect(result.status).toBe("success");
  });

  it("returns an error for unsupported extensions", async () => {
    const file = new File(["binary"], "report.exe", {
      type: "application/octet-stream"
    });

    const result = await convertFile(file);

    expect(result).toEqual({
      markdown: "",
      warnings: [UNSUPPORTED_FILE_MESSAGE],
      status: "error"
    });
  });
});
