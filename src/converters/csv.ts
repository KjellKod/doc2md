import { parseDelimitedText, renderMarkdownTable } from "./delimited";
import { readFileAsText } from "./readText";
import type { Converter } from "./types";

const EMPTY_CSV_MESSAGE = "This CSV file is empty.";
const INVALID_CSV_MESSAGE =
  "This CSV file could not be parsed. Please check that quoted fields are balanced.";

export const convertCsv: Converter = async (file) => {
  try {
    const rows = parseDelimitedText(await readFileAsText(file), ",");

    if (rows.length === 0) {
      return {
        markdown: "",
        warnings: [EMPTY_CSV_MESSAGE],
        status: "error"
      };
    }

    return {
      markdown: renderMarkdownTable(rows),
      warnings: [],
      status: "success"
    };
  } catch (error) {
    if (error instanceof SyntaxError) {
      return {
        markdown: "",
        warnings: [INVALID_CSV_MESSAGE],
        status: "error"
      };
    }

    return {
      markdown: "",
      warnings: ["This CSV file could not be read."],
      status: "error"
    };
  }
};
