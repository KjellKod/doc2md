import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CORRUPT_FILE_MESSAGE } from "./messages";
import * as office from "./office";
import { convertXlsx } from "./xlsx";

const XLSX_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function toArrayBuffer(part: BlobPart) {
  if (typeof part === "string") {
    return Uint8Array.from(Buffer.from(part)).buffer;
  }

  if (part instanceof ArrayBuffer) {
    return part;
  }

  if (ArrayBuffer.isView(part)) {
    return part.buffer.slice(part.byteOffset, part.byteOffset + part.byteLength);
  }

  throw new TypeError("Unsupported BlobPart in XLSX test fixture");
}

function createWorkbookFile(contents: BlobPart[] = [new Uint8Array([1, 2, 3])]) {
  const file = new File(contents, "sample.xlsx", {
    type: XLSX_MIME_TYPE
  });

  if (typeof file.arrayBuffer !== "function") {
    const buffers = contents.map((part) => new Uint8Array(toArrayBuffer(part)));
    const length = buffers.reduce((sum, buffer) => sum + buffer.byteLength, 0);
    const combined = new Uint8Array(length);
    let offset = 0;

    for (const buffer of buffers) {
      combined.set(buffer, offset);
      offset += buffer.byteLength;
    }

    Object.defineProperty(file, "arrayBuffer", {
      value: async () => combined.buffer.slice(0)
    });
  }

  return file;
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
    vi.spyOn(office, "readAllSheets").mockResolvedValue([
      { name: "Empty", rows: [] },
      {
        name: "Projects",
        rows: [
          ["Project", "Owner"],
          ["Atlas", "Jordan"]
        ]
      }
    ]);

    const result = await convertXlsx(createWorkbookFile());

    expect(result.status).toBe("warning");
    expect(result.warnings).toEqual(['Sheet "Empty" is empty and was skipped.']);
    expect(result.markdown).toContain("## Sheet: Projects");
    expect(result.markdown).toContain("| Atlas | Jordan |");
  });

  it("handles corrupt XLSX files with an error result", async () => {
    vi.spyOn(office, "readAllSheets").mockRejectedValue(
      new Error("corrupt workbook")
    );

    const result = await convertXlsx(createWorkbookFile());

    expect(result).toEqual({
      markdown: "",
      warnings: [CORRUPT_FILE_MESSAGE],
      status: "error"
    });
  });
});
