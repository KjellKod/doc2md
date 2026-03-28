import mammoth from "mammoth";
import * as XLSX from "xlsx";

export function convertDocxToHtml(arrayBuffer: ArrayBuffer) {
  if (typeof Buffer !== "undefined") {
    return mammoth.convertToHtml({
      buffer: Buffer.from(arrayBuffer)
    });
  }

  return mammoth.convertToHtml({ arrayBuffer });
}

export function readWorkbook(arrayBuffer: ArrayBuffer) {
  return XLSX.read(arrayBuffer, {
    type: "array"
  });
}

export function sheetToRows(worksheet: XLSX.WorkSheet) {
  return XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
    header: 1,
    raw: false,
    defval: ""
  });
}
