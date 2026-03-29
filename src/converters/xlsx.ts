import { renderMarkdownTable } from "./delimited";
import {
  CORRUPT_FILE_MESSAGE,
  EMPTY_FILE_MESSAGE,
  createErrorResult
} from "./messages";
import { readAllSheets } from "./office";
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
    const sheets = await readAllSheets(file);
    const sections: string[] = [];
    const warnings: string[] = [];

    for (const { name, rows: rawRows } of sheets) {
      const rows = normalizeSheetRows(rawRows);

      if (rows.length === 0) {
        warnings.push(`Sheet "${name}" is empty and was skipped.`);
        continue;
      }

      sections.push(renderSheetSection(name, rows));
    }

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
