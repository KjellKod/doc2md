import mammoth from "mammoth";
import readXlsxFile, { readSheetNames } from "read-excel-file/universal";

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
  const names = await readSheetNames(file);
  const sheets: SheetData[] = [];

  for (const name of names) {
    const rows = await readXlsxFile(file, { sheet: name, trim: false });
    sheets.push({ name, rows });
  }

  return sheets;
}
