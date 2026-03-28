import { parseDelimitedText, renderMarkdownTable } from "./delimited";
import { readFileAsText } from "./readText";
import type { Converter } from "./types";

const EMPTY_TSV_MESSAGE = "This TSV file is empty.";
const INVALID_TSV_MESSAGE =
  "This TSV file could not be parsed. Please check that quoted fields are balanced.";

export const convertTsv: Converter = async (file) => {
  try {
    const rows = parseDelimitedText(await readFileAsText(file), "\t");

    if (rows.length === 0) {
      return {
        markdown: "",
        warnings: [EMPTY_TSV_MESSAGE],
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
        warnings: [INVALID_TSV_MESSAGE],
        status: "error"
      };
    }

    return {
      markdown: "",
      warnings: ["This TSV file could not be read."],
      status: "error"
    };
  }
};
