import { afterEach, describe, expect, it, vi } from "vitest";

const { convertToHtmlMock, readSheetNamesMock, readXlsxFileMock } = vi.hoisted(() => ({
  convertToHtmlMock: vi.fn(),
  readSheetNamesMock: vi.fn(),
  readXlsxFileMock: vi.fn()
}));

vi.mock("mammoth", () => ({
  default: {
    convertToHtml: convertToHtmlMock
  }
}));

vi.mock("read-excel-file/universal", () => ({
  default: readXlsxFileMock,
  readSheetNames: readSheetNamesMock
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
    readSheetNamesMock.mockResolvedValue(["Projects", "Inventory"]);
    readXlsxFileMock
      .mockResolvedValueOnce([["Project"], ["Atlas"]])
      .mockResolvedValueOnce([["Item"], ["Laptop"]]);

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

    expect(readSheetNamesMock).toHaveBeenCalledWith(file);
    expect(readXlsxFileMock).toHaveBeenNthCalledWith(1, file, {
      sheet: "Projects",
      trim: false
    });
    expect(readXlsxFileMock).toHaveBeenNthCalledWith(2, file, {
      sheet: "Inventory",
      trim: false
    });
  });
});
