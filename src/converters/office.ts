import mammoth from "mammoth";
import readXlsxFile from "read-excel-file/universal";

export function convertDocxToHtml(arrayBuffer: ArrayBuffer) {
  if (typeof Buffer !== "undefined") {
    return mammoth.convertToHtml({
      buffer: Buffer.from(arrayBuffer)
    });
  }

  return mammoth.convertToHtml({ arrayBuffer });
}

export interface SheetData {
  name: string;
  rows: unknown[][];
}

export async function readAllSheets(file: File): Promise<SheetData[]> {
  // read-excel-file v9 unified API: a single call returns every sheet as
  // { sheet: name, data: rows }. The old v7 dance with readSheetNames + a
  // per-sheet readXlsxFile is no longer supported.
  const sheets = await readXlsxFile(file, { trim: false });
  return sheets.map((sheet) => ({ name: sheet.sheet, rows: sheet.data }));
}
