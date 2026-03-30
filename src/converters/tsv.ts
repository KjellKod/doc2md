import { parseDelimitedText, renderMarkdownTable } from "./delimited";
import {
  CORRUPT_FILE_MESSAGE,
  EMPTY_FILE_MESSAGE,
  createErrorResult
} from "./messages";
import { readFileAsText } from "./readText";
import type { Converter } from "./types";

export const convertTsv: Converter = async (file) => {
  try {
    const rows = parseDelimitedText(await readFileAsText(file), "\t");

    if (rows.length === 0) {
      return createErrorResult(EMPTY_FILE_MESSAGE);
    }

    return {
      markdown: renderMarkdownTable(rows),
      warnings: [],
      status: "success"
    };
  } catch {
    return createErrorResult(CORRUPT_FILE_MESSAGE);
  }
};
