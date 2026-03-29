import { normalizeLineEndings } from "./delimited";
import { CORRUPT_FILE_MESSAGE, EMPTY_FILE_MESSAGE, createErrorResult } from "./messages";
import { readFileAsText } from "./readText";
import type { Converter } from "./types";

export const convertMd: Converter = async (file) => {
  try {
    const contents = normalizeLineEndings(await readFileAsText(file));

    if (contents.trim().length === 0) {
      return createErrorResult(EMPTY_FILE_MESSAGE);
    }

    return {
      markdown: contents,
      warnings: [],
      status: "success"
    };
  } catch {
    return createErrorResult(CORRUPT_FILE_MESSAGE);
  }
};
