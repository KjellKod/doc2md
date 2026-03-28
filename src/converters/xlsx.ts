import { renderMarkdownTable } from "./delimited";
import {
  CORRUPT_FILE_MESSAGE,
  EMPTY_FILE_MESSAGE,
  createErrorResult
} from "./messages";
import { readWorkbook, sheetToRows } from "./office";
import { readFileAsArrayBuffer } from "./readBinary";
import type { Converter } from "./types";

function stringifyCell(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value);
}

function normalizeSheetRows(rows: unknown[][]) {
  return rows
    .map((row) => row.map(stringifyCell))
    .filter((row) => row.some((cell) => cell.trim().length > 0));
}

function renderSheetSection(sheetName: string, rows: string[][]) {
  return `## Sheet: ${sheetName}\n\n${renderMarkdownTable(rows)}`;
}

export const convertXlsx: Converter = async (file) => {
  try {
    const workbook = readWorkbook(await readFileAsArrayBuffer(file));
    const sections: string[] = [];
    const warnings: string[] = [];

    workbook.SheetNames.forEach((sheetName) => {
      const worksheet = workbook.Sheets[sheetName];
      const rawRows = sheetToRows(worksheet);
      const rows = normalizeSheetRows(rawRows);

      if (rows.length === 0) {
        warnings.push(`Sheet "${sheetName}" is empty and was skipped.`);
        return;
      }

      sections.push(renderSheetSection(sheetName, rows));
    });

    if (sections.length === 0) {
      return createErrorResult(EMPTY_FILE_MESSAGE);
    }

    return {
      markdown: sections.join("\n\n"),
      warnings,
      status: warnings.length > 0 ? "warning" : "success"
    };
  } catch {
    return createErrorResult(CORRUPT_FILE_MESSAGE);
  }
};
