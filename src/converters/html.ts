import {
  CORRUPT_FILE_MESSAGE,
  EMPTY_FILE_MESSAGE,
  createErrorResult
} from "./messages";
import { readFileAsText } from "./readText";
import { convertHtmlFragmentToMarkdown } from "./richText";
import type { Converter } from "./types";

export const convertHtml: Converter = async (file) => {
  try {
    const contents = await readFileAsText(file);

    if (contents.trim().length === 0) {
      return createErrorResult(EMPTY_FILE_MESSAGE);
    }

    const markdown = convertHtmlFragmentToMarkdown(contents);

    if (markdown.length === 0) {
      return createErrorResult(EMPTY_FILE_MESSAGE);
    }

    return {
      markdown,
      warnings: [],
      status: "success"
    };
  } catch {
    return createErrorResult(CORRUPT_FILE_MESSAGE);
  }
};
