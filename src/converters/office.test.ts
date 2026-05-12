import { afterEach, describe, expect, it, vi } from "vitest";

const { convertToHtmlMock, readXlsxFileMock } = vi.hoisted(() => ({
  convertToHtmlMock: vi.fn(),
  readXlsxFileMock: vi.fn()
}));

vi.mock("mammoth", () => ({
  default: {
    convertToHtml: convertToHtmlMock
  }
}));

// read-excel-file v9 exposes a single default export that returns every
// sheet at once. The old named `readSheetNames` is gone.
vi.mock("read-excel-file/universal", () => ({
  default: readXlsxFileMock
}));

import { convertDocxToHtml, readAllSheets } from "./office";

describe("office helpers", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("converts array buffers for mammoth using the runtime-supported input shape", async () => {
    const arrayBuffer = new Uint8Array([1, 2, 3]).buffer;
    convertToHtmlMock.mockResolvedValue({ value: "<p>ok</p>", messages: [] });

    await convertDocxToHtml(arrayBuffer);

    expect(convertToHtmlMock).toHaveBeenCalledTimes(1);
    expect(convertToHtmlMock).toHaveBeenCalledWith({
      buffer: Buffer.from(arrayBuffer)
    });
  });

  it("reads every sheet in order with trim disabled", async () => {
    const file = new File(["ignored"], "sample.xlsx");
    readXlsxFileMock.mockResolvedValue([
      { sheet: "Projects", data: [["Project"], ["Atlas"]] },
      { sheet: "Inventory", data: [["Item"], ["Laptop"]] }
    ]);

    await expect(readAllSheets(file)).resolves.toEqual([
      {
        name: "Projects",
        rows: [["Project"], ["Atlas"]]
      },
      {
        name: "Inventory",
        rows: [["Item"], ["Laptop"]]
      }
    ]);

    expect(readXlsxFileMock).toHaveBeenCalledTimes(1);
    expect(readXlsxFileMock).toHaveBeenCalledWith(file, { trim: false });
  });
});
