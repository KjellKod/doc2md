import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CORRUPT_FILE_MESSAGE } from "./messages";
import { convertXlsx } from "./xlsx";
import * as office from "./office";

const XLSX_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function createWorkbookFile(contents: BlobPart[] = [new Uint8Array([1, 2, 3])]) {
  return new File(contents, "sample.xlsx", {
    type: XLSX_MIME_TYPE
  });
}

describe("convertXlsx", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("converts the sample XLSX fixture into per-sheet Markdown tables", async () => {
    const fixture = fs.readFileSync(path.resolve(process.cwd(), "test-fixtures/sample.xlsx"));
    const file = createWorkbookFile([fixture]);

    const result = await convertXlsx(file);

    expect(result).toMatchObject({
      warnings: [],
      status: "success"
    });
    expect(result.markdown).toContain("## Sheet: Projects");
    expect(result.markdown).toContain("| Project | Owner | Status |");
    expect(result.markdown).toContain("| Atlas | Jordan | On Track |");
    expect(result.markdown).toContain("## Sheet: Inventory");
    expect(result.markdown).toContain("| Item | Category | Count |");
    expect(result.markdown).toContain("| Laptop | Hardware | 14 |");
  });

  it("skips empty sheets and reports a warning", async () => {
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([]), "Empty");
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        ["Project", "Owner"],
        ["Atlas", "Jordan"]
      ]),
      "Projects"
    );

    vi.spyOn(office, "readWorkbook").mockReturnValue(workbook);

    const result = await convertXlsx(createWorkbookFile());

    expect(result.status).toBe("warning");
    expect(result.warnings).toEqual(['Sheet "Empty" is empty and was skipped.']);
    expect(result.markdown).toContain("## Sheet: Projects");
    expect(result.markdown).toContain("| Atlas | Jordan |");
  });

  it("handles corrupt XLSX files with an error result", async () => {
    vi.spyOn(office, "readWorkbook").mockImplementation(() => {
      throw new Error("corrupt workbook");
    });

    const result = await convertXlsx(createWorkbookFile());

    expect(result).toEqual({
      markdown: "",
      warnings: [CORRUPT_FILE_MESSAGE],
      status: "error"
    });
  });
});
